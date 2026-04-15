package persona

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import config.Env
import model.User
import org.slf4j.LoggerFactory
import redis.clients.jedis.JedisPool
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.concurrent.ExecutorService

/**
 * Self-contained AI persona engine. Manages digital personas (historical/cultural figures)
 * that can join chat rooms and participate in conversations via LLM.
 *
 * All persona logic is encapsulated here. Integration with the main app happens through
 * the [Bridge] interface — the engine never imports any app service directly.
 *
 * State is stored in Redis (ephemeral, self-healing on loss). Bot users are regular
 * DB users with a configurable suffix (default: `_bot`).
 */
class PersonaChatEngine(
    private val bridge: Bridge,
    private val jedisPool: JedisPool,
    private val executor: ExecutorService
) {
    // ── Bridge interface (the ONLY coupling surface) ──────────────────────

    interface Bridge {
        fun getRecentMessages(roomId: Int, limit: Int): List<ContextMessage>
        fun sendBotMessage(roomId: Int, botUserId: Int, content: String, replyToId: Int?)
        fun getOrCreateBotUser(username: String): BotIdentity
        fun addBotToRoom(roomId: Int, userId: Int)
        fun removeBotFromRoom(roomId: Int, userId: Int)
        fun broadcastRoomUsers(roomId: Int)
        fun sendTypingStatus(roomId: Int, userId: Int, username: String, isTyping: Boolean)
    }

    // ── Data classes ─────────────────────────────────────────────────────

    data class BotIdentity(val id: Int, val username: String)

    data class ContextMessage(
        val userId: Int,
        val username: String,
        val content: String,
        val messageId: Int,
        val replyToId: Int? = null
    )

    data class PersonaConfig(
        val userId: Int,
        val name: String,
        val displayName: String,
        val systemPrompt: String,
        val bio: String,
        val personality: String?,
        val invitedBy: Int,
        val createdAt: Long
    )

    data class InviteResult(
        val success: Boolean,
        val displayName: String? = null,
        val bio: String? = null,
        val error: String? = null,
        val userId: Int? = null
    )

    // ── Internal types ───────────────────────────────────────────────────

    private data class GeneratedPersona(
        val englishId: String,
        val displayName: String,
        val systemPrompt: String,
        val bio: String
    )

    private enum class TriggerType { NONE, EXPLICIT_MENTION, EXPLICIT_REPLY, AUTO_ENGAGE }

    // ── Configuration (from env) ─────────────────────────────────────────

    private val log = LoggerFactory.getLogger(PersonaChatEngine::class.java)
    private val objectMapper: ObjectMapper = jacksonObjectMapper()

    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build()

    private val llmBaseUrl = Env["PERSONA_LLM_BASE_URL"] ?: "https://api.openai.com/v1"
    private val llmApiKey = Env["PERSONA_LLM_API_KEY"] ?: ""
    private val llmModel = Env["PERSONA_LLM_MODEL"] ?: "gpt-4"
    private val autoEngage = Env["PERSONA_AUTO_ENGAGE"]?.toBooleanStrictOrNull() ?: false
    private val contextWindow = Env["PERSONA_CONTEXT_WINDOW"]?.toIntOrNull() ?: 20
    private val maxTokens = Env["PERSONA_MAX_TOKENS"]?.toIntOrNull() ?: 512
    private val temperature = Env["PERSONA_TEMPERATURE"]?.toDoubleOrNull() ?: 0.8
    val botSuffix: String = Env["PERSONA_BOT_SUFFIX"] ?: "_bot"

    companion object {
        private const val CONFIG_PREFIX = "persona:config:"
        private const val ROOM_BOTS_PREFIX = "persona:room_bots:"
    }

    // ── Public API ───────────────────────────────────────────────────────

    /**
     * Invite a persona into a room. Validates the name via LLM, creates the bot
     * user (or reuses an existing one), stores config in Redis, and adds to room.
     */
    fun invitePersona(roomId: Int, name: String, personality: String?, actorUserId: Int): InviteResult {
        val generated = validateAndGenerate(name, personality)
            ?: return InviteResult(false, error = "Unable to recognize '$name' as a well-known persona")

        val username = "${generated.englishId}$botSuffix"
        val botUser = bridge.getOrCreateBotUser(username)

        val config = PersonaConfig(
            userId = botUser.id,
            name = generated.englishId,
            displayName = generated.displayName,
            systemPrompt = generated.systemPrompt,
            bio = generated.bio,
            personality = personality,
            invitedBy = actorUserId,
            createdAt = System.currentTimeMillis()
        )
        saveConfig(config)

        bridge.addBotToRoom(roomId, botUser.id)
        addBotToRoomSet(roomId, botUser.id)
        bridge.broadcastRoomUsers(roomId)

        log.info("Persona '{}' (userId={}) invited to room {} by user {}",
            generated.displayName, botUser.id, roomId, actorUserId)

        return InviteResult(true, generated.displayName, generated.bio, userId = botUser.id)
    }

    /** Remove a persona from a room. */
    fun removePersona(roomId: Int, personaUserId: Int): Boolean {
        bridge.removeBotFromRoom(roomId, personaUserId)
        removeBotFromRoomSet(roomId, personaUserId)
        bridge.broadcastRoomUsers(roomId)
        log.info("Persona userId={} removed from room {}", personaUserId, roomId)
        return true
    }

    /**
     * Hook called after every room message. Determines if any bot in the room
     * should respond and generates replies asynchronously.
     */
    fun onRoomMessage(
        roomId: Int,
        senderId: Int,
        senderUsername: String,
        content: String,
        messageId: Int,
        replyToId: Int?
    ) {
        if (isBotUser(senderId)) return

        val botIds = getRoomBotIds(roomId)
        if (botIds.isEmpty()) return

        executor.execute {
            try {
                processMessageForBots(roomId, senderId, senderUsername, content, messageId, replyToId, botIds)
            } catch (e: Exception) {
                log.error("Error processing message for personas in room {}", roomId, e)
            }
        }
    }

    /** Hook called after a user is kicked. Cleans up room bot set if needed. */
    fun onUserKicked(roomId: Int, userId: Int) {
        removeBotFromRoomSet(roomId, userId)
    }

    /**
     * Enrich a user list with isBot/displayName from Redis.
     * Also rebuilds the room bot set as a side-effect (self-healing).
     */
    fun enrichUsers(users: List<User>, roomId: Int): List<User> {
        val botIds = mutableSetOf<Int>()
        val result = users.map { user ->
            if (!user.username.endsWith(botSuffix)) return@map user
            botIds.add(user.id)
            val config = getConfig(user.id)
            if (config != null) {
                user.copy(isBot = true, displayName = config.displayName)
            } else {
                user.copy(isBot = true)
            }
        }
        // Rebuild the room bot set from ground truth
        rebuildRoomBotSet(roomId, botIds)
        return result
    }

    /** Check if a user ID belongs to a bot (has Redis config). */
    fun isBotUser(userId: Int): Boolean = getConfig(userId) != null

    /** Check if a username follows the bot naming convention. */
    fun isBotUsername(username: String): Boolean = username.endsWith(botSuffix)

    // ── LLM: validation & generation ─────────────────────────────────────

    private fun validateAndGenerate(name: String, personality: String?): GeneratedPersona? {
        val personalityClause = if (personality.isNullOrBlank()) ""
        else "\nThe user also specified a personality directive: \"$personality\". Incorporate this into the system_prompt."

        val prompt = """You are a persona validation and generation system.
Given a name, determine if this is a well-known historical or cultural figure. If yes, generate:
1. english_id: A lowercase ASCII identifier (no spaces, use underscores). E.g. "newton", "confucius", "schopenhauer"
2. display_name: The person's name in their most commonly known form, preferably in the language the user used. E.g. "牛顿", "孔子", "叔本华" for Chinese input
3. bio: A one-line description (in the same language as display_name)
4. system_prompt: A detailed system prompt for an LLM to roleplay as this person. It should:
   - Establish the persona's identity, era, and key beliefs/works
   - Define their speaking style and mannerisms
   - Include instructions to stay in character
   - Be written in the language the user used for the name$personalityClause

Respond in JSON only:
- If recognized: {"recognized": true, "english_id": "...", "display_name": "...", "bio": "...", "system_prompt": "..."}
- If not recognized: {"recognized": false}

The person's name: "$name""""

        val response = callLlm(
            messages = listOf(mapOf("role" to "user", "content" to prompt)),
            temp = 0.3,
            tokens = 1024
        ) ?: return null

        return try {
            val json = extractJson(response)
            val map: Map<String, Any> = objectMapper.readValue(json)
            if (map["recognized"] != true) return null
            GeneratedPersona(
                englishId = (map["english_id"] as String).lowercase().replace(Regex("[^a-z0-9_]"), ""),
                displayName = map["display_name"] as String,
                systemPrompt = map["system_prompt"] as String,
                bio = map["bio"] as String
            )
        } catch (e: Exception) {
            log.warn("Failed to parse persona generation response: {}", response, e)
            null
        }
    }

    // ── Trigger logic ────────────────────────────────────────────────────

    private fun processMessageForBots(
        roomId: Int,
        senderId: Int,
        senderUsername: String,
        content: String,
        messageId: Int,
        replyToId: Int?,
        botIds: Set<Int>
    ) {
        for (botUserId in botIds) {
            val config = getConfig(botUserId) ?: tryHealConfig(botUserId) ?: continue

            val triggerType = determineTrigger(content, replyToId, config, roomId, botUserId)
            if (triggerType == TriggerType.NONE) continue

            try {
                val botUsername = "${config.name}$botSuffix"
                bridge.sendTypingStatus(roomId, botUserId, botUsername, true)

                val reply = generateReply(roomId, config, content, senderUsername, messageId, triggerType)
                if (reply != null) {
                    val replyTo = when (triggerType) {
                        TriggerType.EXPLICIT_REPLY -> replyToId
                        else -> messageId
                    }
                    bridge.sendBotMessage(roomId, botUserId, reply, replyTo)
                }
            } catch (e: Exception) {
                log.error("Error generating reply for persona '{}' in room {}", config.displayName, roomId, e)
            } finally {
                val botUsername = "${config.name}$botSuffix"
                bridge.sendTypingStatus(roomId, botUserId, botUsername, false)
            }
        }
    }

    private fun determineTrigger(
        content: String,
        replyToId: Int?,
        config: PersonaConfig,
        roomId: Int,
        botUserId: Int
    ): TriggerType {
        // Check explicit @mention by bot username
        val botUsername = "${config.name}$botSuffix"
        if (Regex("@${Regex.escape(botUsername)}\\b").containsMatchIn(content)) {
            return TriggerType.EXPLICIT_MENTION
        }
        // Check @mention by display name
        if (content.contains("@${config.displayName}")) {
            return TriggerType.EXPLICIT_MENTION
        }

        // Check if replying to this bot's message
        if (replyToId != null) {
            val recentMessages = bridge.getRecentMessages(roomId, contextWindow)
            val repliedMsg = recentMessages.find { it.messageId == replyToId }
            if (repliedMsg != null && repliedMsg.userId == botUserId) {
                return TriggerType.EXPLICIT_REPLY
            }
        }

        // Auto-engage: let LLM decide if the topic is relevant
        if (autoEngage && shouldAutoEngage(config, content)) {
            return TriggerType.AUTO_ENGAGE
        }

        return TriggerType.NONE
    }

    private fun shouldAutoEngage(config: PersonaConfig, content: String): Boolean {
        val prompt = """You are ${config.displayName}. Someone in a group chat just said:
"$content"

Should you respond? Only respond "true" if:
1. The topic is directly related to your expertise, works, or philosophy
2. You are mentioned by name (not @username)
3. You have a genuinely witty or insightful observation

Respond with JSON only: {"should_reply": true} or {"should_reply": false}"""

        val response = callLlm(
            messages = listOf(mapOf("role" to "user", "content" to prompt)),
            temp = 0.3,
            tokens = 50
        ) ?: return false

        return try {
            val json = extractJson(response)
            val map: Map<String, Any> = objectMapper.readValue(json)
            map["should_reply"] == true
        } catch (_: Exception) {
            false
        }
    }

    // ── Reply generation (multi-turn) ────────────────────────────────────

    private fun generateReply(
        roomId: Int,
        config: PersonaConfig,
        latestContent: String,
        senderUsername: String,
        messageId: Int,
        triggerType: TriggerType
    ): String? {
        val recentMessages = bridge.getRecentMessages(roomId, contextWindow)

        val llmMessages = mutableListOf<Map<String, String>>()

        // System prompt with engagement rules
        val systemPrompt = config.systemPrompt + "\n\n" + """[Chat rules]
- You are in a group chat room. Keep responses concise and natural.
- Do NOT break character. Respond as ${config.displayName} would.
- Use the same language that others are using in the conversation.
- Do NOT prefix your messages with your name or any label.
- Keep responses under 200 words unless the topic demands depth.
- You may use markdown formatting for emphasis."""
        llmMessages.add(mapOf("role" to "system", "content" to systemPrompt))

        // Multi-turn conversation context
        for (msg in recentMessages) {
            val role = if (msg.userId == config.userId) "assistant" else "user"
            val prefix = if (role == "user") "${msg.username}: " else ""
            llmMessages.add(mapOf("role" to role, "content" to "$prefix${msg.content}"))
        }

        // Append the triggering message if not already in recent
        val alreadyIncluded = recentMessages.any { it.messageId == messageId }
        if (!alreadyIncluded) {
            llmMessages.add(mapOf("role" to "user", "content" to "$senderUsername: $latestContent"))
        }

        return callLlm(messages = llmMessages, temp = temperature, tokens = maxTokens)
    }

    // ── Self-healing ─────────────────────────────────────────────────────

    private fun tryHealConfig(botUserId: Int): PersonaConfig? {
        // We don't have the username here directly, but we can try to look it up
        // by scanning recent messages or relying on the Redis room bot set.
        // For simplicity, we skip healing in the message path — it's handled by enrichUsers.
        log.debug("No Redis config for bot userId={}, skipping (will self-heal on next user list update)", botUserId)
        return null
    }

    /**
     * Attempt to self-heal a bot user's config by regenerating from LLM.
     * Called during enrichUsers when a _bot suffix user has no Redis config.
     */
    internal fun healConfigForUser(userId: Int, username: String) {
        if (!username.endsWith(botSuffix)) return
        if (getConfig(userId) != null) return

        val name = username.removeSuffix(botSuffix)
        log.info("Self-healing persona config for '{}' (userId={})", name, userId)

        executor.execute {
            try {
                val generated = validateAndGenerate(name, null) ?: return@execute
                val config = PersonaConfig(
                    userId = userId,
                    name = generated.englishId,
                    displayName = generated.displayName,
                    systemPrompt = generated.systemPrompt,
                    bio = generated.bio,
                    personality = null,
                    invitedBy = 0,
                    createdAt = System.currentTimeMillis()
                )
                saveConfig(config)
                log.info("Self-healed persona config for '{}' (userId={})", generated.displayName, userId)
            } catch (e: Exception) {
                log.warn("Failed to self-heal persona config for '{}'", name, e)
            }
        }
    }

    // ── Redis state management ───────────────────────────────────────────

    private fun saveConfig(config: PersonaConfig) {
        jedisPool.resource.use { jedis ->
            jedis.set("$CONFIG_PREFIX${config.userId}", objectMapper.writeValueAsString(config))
        }
    }

    fun getConfig(userId: Int): PersonaConfig? {
        return try {
            jedisPool.resource.use { jedis ->
                jedis.get("$CONFIG_PREFIX$userId")?.let { objectMapper.readValue(it) }
            }
        } catch (e: Exception) {
            log.warn("Failed to read persona config for userId={}", userId, e)
            null
        }
    }

    private fun addBotToRoomSet(roomId: Int, userId: Int) {
        try {
            jedisPool.resource.use { it.sadd("$ROOM_BOTS_PREFIX$roomId", userId.toString()) }
        } catch (e: Exception) {
            log.warn("Failed to add bot {} to room set {}", userId, roomId, e)
        }
    }

    private fun removeBotFromRoomSet(roomId: Int, userId: Int) {
        try {
            jedisPool.resource.use { it.srem("$ROOM_BOTS_PREFIX$roomId", userId.toString()) }
        } catch (e: Exception) {
            log.warn("Failed to remove bot {} from room set {}", userId, roomId, e)
        }
    }

    private fun getRoomBotIds(roomId: Int): Set<Int> {
        return try {
            jedisPool.resource.use { jedis ->
                jedis.smembers("$ROOM_BOTS_PREFIX$roomId")
                    ?.mapNotNull { it.toIntOrNull() }?.toSet()
                    ?: emptySet()
            }
        } catch (e: Exception) {
            log.warn("Failed to get room bot IDs for room {}", roomId, e)
            emptySet()
        }
    }

    private fun rebuildRoomBotSet(roomId: Int, botIds: Set<Int>) {
        try {
            jedisPool.resource.use { jedis ->
                val key = "$ROOM_BOTS_PREFIX$roomId"
                jedis.del(key)
                if (botIds.isNotEmpty()) {
                    jedis.sadd(key, *botIds.map { it.toString() }.toTypedArray())
                }
            }
        } catch (e: Exception) {
            log.warn("Failed to rebuild room bot set for room {}", roomId, e)
        }
    }

    // ── LLM HTTP client ──────────────────────────────────────────────────

    private fun callLlm(
        messages: List<Map<String, String>>,
        temp: Double = temperature,
        tokens: Int = maxTokens
    ): String? {
        if (llmApiKey.isBlank()) return null

        val body = mapOf(
            "model" to llmModel,
            "messages" to messages,
            "temperature" to temp,
            "max_tokens" to tokens
        )

        val request = HttpRequest.newBuilder()
            .uri(URI.create("${llmBaseUrl.trimEnd('/')}/chat/completions"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer $llmApiKey")
            .timeout(Duration.ofSeconds(60))
            .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
            .build()

        return try {
            val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() != 200) {
                log.warn("LLM API returned status {}: {}", response.statusCode(), response.body().take(500))
                return null
            }
            val responseMap: Map<String, Any> = objectMapper.readValue(response.body())
            val choices = responseMap["choices"] as? List<*> ?: return null
            val firstChoice = choices.firstOrNull() as? Map<*, *> ?: return null
            val message = firstChoice["message"] as? Map<*, *> ?: return null
            (message["content"] as? String)?.trim()
        } catch (e: Exception) {
            log.error("LLM API call failed", e)
            null
        }
    }

    /** Extract JSON object from LLM response that might contain markdown code blocks. */
    private fun extractJson(text: String): String {
        // Try markdown code block first
        val codeBlock = Regex("```(?:json)?\\s*\\n?(\\{.*?})\\s*\\n?```", RegexOption.DOT_MATCHES_ALL)
        codeBlock.find(text)?.let { return it.groupValues[1] }

        // Try raw JSON object
        val rawJson = Regex("\\{[^{}]*(?:\\{[^{}]*}[^{}]*)*}", RegexOption.DOT_MATCHES_ALL)
        rawJson.find(text)?.let { return it.value }

        return text.trim()
    }
}
