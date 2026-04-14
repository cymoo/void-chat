package repository

import chatroom.jooq.generated.Tables.MESSAGES
import chatroom.jooq.generated.Tables.USERS
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import model.ChatMessage
import model.ReplyInfo
import org.jooq.DSLContext
import org.jooq.JSONB
import org.jooq.Record
import org.jooq.impl.DSL
import util.toEpochMillis
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Repository for room messages stored with JSONB content.
 *
 * Content column shape per message_type:
 * - text:   `{"text": "..."}`
 * - image:  `{"url": "...", "thumbnail": "...", "width": N, "height": N}`
 * - file:   `{"url": "...", "name": "...", "size": N, "mime": "..."}`
 * - system: `{"text": "..."}`
 */
class MessageRepository(private val dsl: DSLContext) {

    private val objectMapper = ObjectMapper()

    /** Visible messages: non-system, non-deleted. */
    private val visibleCondition = MESSAGES.MESSAGE_TYPE.ne("system")
        .and(MESSAGES.IS_DELETED.eq(false))

    private val messageFields = arrayOf(
        MESSAGES.ID,
        MESSAGES.ROOM_ID,
        MESSAGES.USER_ID,
        MESSAGES.MESSAGE_TYPE,
        MESSAGES.CONTENT,
        MESSAGES.CREATED_AT,
        MESSAGES.EDITED_AT,
        MESSAGES.IS_DELETED,
        MESSAGES.REPLY_TO_ID,
        USERS.USERNAME,
        USERS.AVATAR_URL
    )

    // SQL expression for text search on JSONB content
    private val jsonTextExpr = DSL.field("content->>'text'", String::class.java)

    /** Save a text message. Returns the new message ID. */
    fun saveTextMessage(roomId: Int, userId: Int, text: String, replyToId: Int? = null): Int {
        return saveMessage(roomId, userId, "text", jsonbOf("text" to text), replyToId)
    }

    /** Save an image message. Returns the new message ID. */
    fun saveImageMessage(
        roomId: Int, userId: Int, imageUrl: String, thumbnailUrl: String?,
        width: Int? = null, height: Int? = null, replyToId: Int? = null
    ): Int {
        val map = mutableMapOf<String, Any?>("url" to imageUrl, "thumbnail" to thumbnailUrl)
        if (width != null) map["width"] = width
        if (height != null) map["height"] = height
        return saveMessage(roomId, userId, "image", jsonbOf(map), replyToId)
    }

    /** Save a file message. Returns the new message ID. */
    fun saveFileMessage(
        roomId: Int, userId: Int, fileName: String, fileUrl: String,
        fileSize: Long, mimeType: String, replyToId: Int? = null
    ): Int {
        return saveMessage(
            roomId, userId, "file",
            jsonbOf("url" to fileUrl, "name" to fileName, "size" to fileSize, "mime" to mimeType),
            replyToId
        )
    }

    /** Save a system message (no user). Returns the new message ID. */
    fun saveSystemMessage(roomId: Int, text: String): Int {
        return saveMessage(roomId, null, "system", jsonbOf("text" to text), null)
    }

    /** Edit a text message's content. Only the original author can edit. */
    fun updateMessage(messageId: Int, userId: Int, newText: String): Boolean {
        return dsl.update(MESSAGES)
            .set(MESSAGES.CONTENT, jsonbOf("text" to newText))
            .set(MESSAGES.EDITED_AT, OffsetDateTime.now(ZoneOffset.UTC))
            .where(MESSAGES.ID.eq(messageId))
            .and(MESSAGES.USER_ID.eq(userId))
            .and(MESSAGES.MESSAGE_TYPE.eq("text"))
            .execute() > 0
    }

    /** Soft-delete a message (only if owned by [userId]). */
    fun softDeleteMessage(messageId: Int, userId: Int): Boolean {
        return dsl.update(MESSAGES)
            .set(MESSAGES.IS_DELETED, true)
            .where(MESSAGES.ID.eq(messageId))
            .and(MESSAGES.USER_ID.eq(userId))
            .execute() > 0
    }

    /** Soft-delete a message regardless of owner (admin action). */
    fun adminDeleteMessage(messageId: Int): Boolean {
        return dsl.update(MESSAGES)
            .set(MESSAGES.IS_DELETED, true)
            .where(MESSAGES.ID.eq(messageId))
            .execute() > 0
    }

    /** Fetch the most recent visible messages for a room, ordered chronologically. */
    fun getRecentMessages(roomId: Int, limit: Int = 30): List<ChatMessage> {
        val records = baseQuery()
            .where(MESSAGES.ROOM_ID.eq(roomId)).and(visibleCondition)
            .orderBy(MESSAGES.ID.desc())
            .limit(limit)
            .fetch()
        return mapRecordsToMessages(records.reversed())
    }

    /** Fetch visible messages before [beforeId] (cursor pagination). */
    fun getMessagesBefore(roomId: Int, beforeId: Int, limit: Int = 30): List<ChatMessage> {
        val records = baseQuery()
            .where(MESSAGES.ROOM_ID.eq(roomId)).and(visibleCondition)
            .and(MESSAGES.ID.lt(beforeId))
            .orderBy(MESSAGES.ID.desc())
            .limit(limit)
            .fetch()
        return mapRecordsToMessages(records.reversed())
    }

    /** Case-insensitive LIKE search on text content within a room. */
    fun searchMessages(roomId: Int, query: String, limit: Int = 50): List<ChatMessage> {
        val escaped = query
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        val pattern = "%$escaped%"

        val records = baseQuery()
            .where(MESSAGES.ROOM_ID.eq(roomId)).and(visibleCondition)
            .and(jsonTextExpr.likeIgnoreCase(pattern, '\\'))
            .orderBy(MESSAGES.ID.desc())
            .limit(limit)
            .fetch()
        return mapRecordsToMessages(records.reversed())
    }

    /** Get reply info for a single message. */
    fun getReplyInfo(messageId: Int): ReplyInfo? =
        getReplyInfoMap(listOf(messageId))[messageId]

    // ---- Internal helpers ----

    private fun saveMessage(
        roomId: Int, userId: Int?, type: String, content: JSONB, replyToId: Int?
    ): Int {
        var step = dsl.insertInto(MESSAGES)
            .set(MESSAGES.ROOM_ID, roomId)
            .set(MESSAGES.USER_ID, userId)
            .set(MESSAGES.MESSAGE_TYPE, type)
            .set(MESSAGES.CONTENT, content)
        if (replyToId != null) step = step.set(MESSAGES.REPLY_TO_ID, replyToId)
        return step.returningResult(MESSAGES.ID).fetchOne()!!.get(MESSAGES.ID)!!
    }

    private fun baseQuery() = dsl.select(*messageFields).from(MESSAGES)
        .leftJoin(USERS).on(MESSAGES.USER_ID.eq(USERS.ID))

    /** Batch-resolve reply info for multiple message IDs. */
    private fun getReplyInfoMap(replyIds: Collection<Int>): Map<Int, ReplyInfo> {
        if (replyIds.isEmpty()) return emptyMap()
        return dsl.select(MESSAGES.ID, MESSAGES.MESSAGE_TYPE, MESSAGES.CONTENT, USERS.USERNAME)
            .from(MESSAGES).leftJoin(USERS).on(MESSAGES.USER_ID.eq(USERS.ID))
            .where(MESSAGES.ID.`in`(replyIds)).and(MESSAGES.IS_DELETED.eq(false))
            .fetch()
            .associate { r ->
                val id = r.get(MESSAGES.ID)!!
                val type = r.get(MESSAGES.MESSAGE_TYPE) ?: "text"
                val preview = replyPreview(type, r)
                id to ReplyInfo(id, r.get(USERS.USERNAME) ?: "unknown", preview, type)
            }
    }

    /** Build a short preview string for a reply reference. */
    private fun replyPreview(type: String, record: Record): String {
        val content = parseContent(record.get(MESSAGES.CONTENT))
        val raw = when (type) {
            "text", "system" -> content["text"] as? String ?: ""
            "image" -> "[Image]"
            "file" -> content["name"] as? String ?: "[File]"
            else -> ""
        }
        return if (raw.length > 100) raw.take(100) + "…" else raw
    }

    private fun mapRecordsToMessages(records: List<Record>): List<ChatMessage> {
        if (records.isEmpty()) return emptyList()
        val replyInfoById = getReplyInfoMap(records.mapNotNull { it.get(MESSAGES.REPLY_TO_ID) }.distinct())
        return records.map { r ->
            val replyInfo = r.get(MESSAGES.REPLY_TO_ID)?.let { replyInfoById[it] }
            mapRecord(r, replyInfo)
        }
    }

    private fun mapRecord(r: Record, replyInfo: ReplyInfo?): ChatMessage {
        val type = r.get(MESSAGES.MESSAGE_TYPE)!!
        val id = r.get(MESSAGES.ID)!!
        val ts = r.get(MESSAGES.CREATED_AT).toEpochMillis()
        val userId = r.get(MESSAGES.USER_ID) ?: 0
        val username = r.get(USERS.USERNAME) ?: "system"
        val avatar = r.get(USERS.AVATAR_URL)
        val editedAt = r.get(MESSAGES.EDITED_AT).toEpochMillis().takeIf { r.get(MESSAGES.EDITED_AT) != null }
        val content = parseContent(r.get(MESSAGES.CONTENT))

        return when (type) {
            "text" -> ChatMessage.Text(id, userId, username, avatar,
                content["text"] as? String ?: "", editedAt, ts, replyInfo)
            "image" -> ChatMessage.Image(id, userId, username, avatar,
                content["url"] as? String ?: "", content["thumbnail"] as? String,
                (content["width"] as? Number)?.toInt(), (content["height"] as? Number)?.toInt(),
                ts, replyInfo)
            "file" -> ChatMessage.File(id, userId, username, avatar,
                content["name"] as? String ?: "", content["url"] as? String ?: "",
                (content["size"] as? Number)?.toLong() ?: 0L,
                content["mime"] as? String ?: "application/octet-stream",
                ts, replyInfo)
            "system" -> ChatMessage.System(id, content["text"] as? String ?: "", ts)
            else -> throw IllegalStateException("Unknown message type: $type")
        }
    }

    /** Parse JSONB content column into a Map. Returns empty map on null/error. */
    private fun parseContent(jsonb: JSONB?): Map<String, Any?> {
        if (jsonb == null) return emptyMap()
        return try {
            objectMapper.readValue(jsonb.data())
        } catch (_: Exception) {
            emptyMap()
        }
    }

    /** Build a JSONB literal from key-value pairs, omitting null values. */
    private fun jsonbOf(vararg pairs: Pair<String, Any?>): JSONB = jsonbOf(pairs.toMap())

    private fun jsonbOf(map: Map<String, Any?>): JSONB {
        val filtered = map.filterValues { it != null }
        val json = filtered.entries.joinToString(",", "{", "}") { (k, v) ->
            val valueStr = when (v) {
                is String -> "\"${v.replace("\\", "\\\\").replace("\"", "\\\"")}\""
                else -> v.toString()
            }
            "\"$k\":$valueStr"
        }
        return JSONB.jsonb(json)
    }
}
