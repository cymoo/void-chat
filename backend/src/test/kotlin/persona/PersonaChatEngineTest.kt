package persona

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.mockk.*
import model.User
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import redis.clients.jedis.Jedis
import redis.clients.jedis.JedisPool
import java.util.concurrent.ExecutorService

class PersonaChatEngineTest {

    private val objectMapper = jacksonObjectMapper()
    private val bridge = mockk<PersonaChatEngine.Bridge>(relaxed = true)
    private val jedis = mockk<Jedis>(relaxed = true)
    private val jedisPool = mockk<JedisPool>()
    private val executor = mockk<ExecutorService>()
    private lateinit var engine: PersonaChatEngine

    @BeforeEach
    fun setUp() {
        every { jedisPool.resource } returns jedis
        every { jedis.close() } just Runs
        // Execute tasks synchronously in tests
        every { executor.execute(any()) } answers {
            firstArg<Runnable>().run()
        }
        engine = PersonaChatEngine(bridge, jedisPool, executor)
    }

    @AfterEach
    fun tearDown() {
        clearAllMocks()
    }

    // ── isBotUsername ────────────────────────────────────────────────────

    @Test
    fun `isBotUsername returns true for _bot suffix`() {
        assertTrue(engine.isBotUsername("newton_bot"))
        assertTrue(engine.isBotUsername("confucius_bot"))
    }

    @Test
    fun `isBotUsername returns false for regular usernames`() {
        assertFalse(engine.isBotUsername("alice"))
        assertFalse(engine.isBotUsername("bot_newton"))
        assertFalse(engine.isBotUsername("botuser"))
    }

    // ── isBotUser ───────────────────────────────────────────────────────

    @Test
    fun `isBotUser returns true when Redis config exists`() {
        every { jedis.get("persona:config:42") } returns
                """{"userId":42,"name":"newton","displayName":"牛顿","systemPrompt":"...","bio":"...","personality":null,"invitedBy":1,"createdAt":1000}"""
        assertTrue(engine.isBotUser(42))
    }

    @Test
    fun `isBotUser returns false when no Redis config`() {
        every { jedis.get("persona:config:99") } returns null
        assertFalse(engine.isBotUser(99))
    }

    @Test
    fun `isBotUser returns false when Redis throws`() {
        every { jedis.get(any<String>()) } throws RuntimeException("connection lost")
        assertFalse(engine.isBotUser(1))
    }

    // ── enrichUsers ─────────────────────────────────────────────────────

    private fun makeUser(id: Int, username: String, role: String = "user") =
        User(id = id, username = username, role = role, createdAt = 1000L, lastSeen = 1000L)

    @Test
    fun `enrichUsers marks bot users with isBot and displayName`() {
        val configJson = objectMapper.writeValueAsString(
            PersonaChatEngine.PersonaConfig(
                userId = 5, name = "schopenhauer", displayName = "叔本华",
                systemPrompt = "...", bio = "...", personality = null,
                invitedBy = 1, createdAt = 1000
            )
        )
        every { jedis.get("persona:config:5") } returns configJson

        val users = listOf(
            makeUser(1, "alice"),
            makeUser(5, "schopenhauer_bot", "member"),
        )

        val enriched = engine.enrichUsers(users, roomId = 1)

        assertEquals(2, enriched.size)
        assertFalse(enriched[0].isBot)
        assertNull(enriched[0].displayName)
        assertTrue(enriched[1].isBot)
        assertEquals("叔本华", enriched[1].displayName)
    }

    @Test
    fun `enrichUsers marks bot user as isBot even without Redis config`() {
        every { jedis.get("persona:config:5") } returns null

        val users = listOf(makeUser(5, "newton_bot", "member"))

        val enriched = engine.enrichUsers(users, roomId = 1)
        assertTrue(enriched[0].isBot)
        assertNull(enriched[0].displayName)
    }

    @Test
    fun `enrichUsers rebuilds room bot set`() {
        val configJson = objectMapper.writeValueAsString(
            PersonaChatEngine.PersonaConfig(
                userId = 10, name = "confucius", displayName = "孔子",
                systemPrompt = "...", bio = "...", personality = null,
                invitedBy = 1, createdAt = 1000
            )
        )
        every { jedis.get("persona:config:10") } returns configJson

        val users = listOf(
            makeUser(1, "alice"),
            makeUser(10, "confucius_bot", "member"),
        )

        engine.enrichUsers(users, roomId = 7)

        verify { jedis.del("persona:room_bots:7") }
        verify { jedis.sadd("persona:room_bots:7", "10") }
    }

    // ── removePersona ───────────────────────────────────────────────────

    @Test
    fun `removePersona calls bridge and cleans up Redis`() {
        assertTrue(engine.removePersona(roomId = 3, personaUserId = 42))

        verify { bridge.removeBotFromRoom(3, 42) }
        verify { jedis.srem("persona:room_bots:3", "42") }
        verify { bridge.broadcastRoomUsers(3) }
    }

    // ── onRoomMessage anti-recursion ────────────────────────────────────

    @Test
    fun `onRoomMessage ignores messages from bot users`() {
        // Set up bot config so isBotUser returns true
        every { jedis.get("persona:config:5") } returns
                """{"userId":5,"name":"newton","displayName":"牛顿","systemPrompt":"...","bio":"...","personality":null,"invitedBy":1,"createdAt":1000}"""

        engine.onRoomMessage(roomId = 1, senderId = 5, senderUsername = "newton_bot",
            content = "Hello", messageId = 100, replyToId = null)

        // executor.execute should NOT have been called
        verify(exactly = 0) { executor.execute(any()) }
    }

    @Test
    fun `onRoomMessage ignores rooms with no bots`() {
        every { jedis.get("persona:config:99") } returns null
        every { jedis.smembers("persona:room_bots:1") } returns emptySet()

        engine.onRoomMessage(roomId = 1, senderId = 99, senderUsername = "alice",
            content = "Hello", messageId = 100, replyToId = null)

        verify(exactly = 0) { executor.execute(any()) }
    }

    // ── getConfig ───────────────────────────────────────────────────────

    @Test
    fun `getConfig returns PersonaConfig when Redis has data`() {
        val config = PersonaChatEngine.PersonaConfig(
            userId = 42, name = "kant", displayName = "康德",
            systemPrompt = "You are Kant", bio = "German philosopher",
            personality = "严肃", invitedBy = 1, createdAt = 1000
        )
        every { jedis.get("persona:config:42") } returns objectMapper.writeValueAsString(config)

        val result = engine.getConfig(42)

        assertNotNull(result)
        assertEquals("康德", result!!.displayName)
        assertEquals("严肃", result.personality)
        assertEquals(42, result.userId)
    }

    @Test
    fun `getConfig returns null when Redis has no data`() {
        every { jedis.get("persona:config:99") } returns null
        assertNull(engine.getConfig(99))
    }

    @Test
    fun `getConfig returns null when Redis throws`() {
        every { jedis.get(any<String>()) } throws RuntimeException("timeout")
        assertNull(engine.getConfig(1))
    }
}
