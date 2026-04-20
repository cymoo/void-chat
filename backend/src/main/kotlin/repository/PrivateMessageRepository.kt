package repository

import chatroom.jooq.generated.Tables.PRIVATE_MESSAGES
import chatroom.jooq.generated.Tables.USERS
import model.DmInboxEntry
import model.PrivateMessage
import model.UnreadSender
import org.jooq.DSLContext
import org.jooq.JSONB
import org.jooq.Record
import org.jooq.impl.DSL.count
import util.JsonbUtils.jsonbOf
import util.JsonbUtils.parseContent
import util.toEpochMillis

/**
 * Repository for direct messages stored with JSONB content.
 *
 * Content column shape mirrors room messages (see [MessageRepository]).
 */
class PrivateMessageRepository(private val dsl: DSLContext) {

    private val SENDER = USERS.`as`("sender")
    private val RECEIVER = USERS.`as`("receiver")

    /** Save a text DM. */
    fun saveTextMessage(senderId: Int, receiverId: Int, text: String): Int {
        return insertMessage(senderId, receiverId, "text", jsonbOf("text" to text))
    }

    /** Save an image DM. */
    fun saveImageMessage(
        senderId: Int, receiverId: Int, imageUrl: String, thumbnailUrl: String?,
        width: Int? = null, height: Int? = null
    ): Int {
        val map = mutableMapOf<String, Any?>("url" to imageUrl, "thumbnail" to thumbnailUrl)
        if (width != null) map["width"] = width
        if (height != null) map["height"] = height
        return insertMessage(senderId, receiverId, "image", jsonbOf(map))
    }

    /** Save a file DM. */
    fun saveFileMessage(
        senderId: Int, receiverId: Int, fileName: String, fileUrl: String,
        fileSize: Long, mimeType: String
    ): Int {
        return insertMessage(
            senderId, receiverId, "file",
            jsonbOf("url" to fileUrl, "name" to fileName, "size" to fileSize, "mime" to mimeType)
        )
    }

    /** Fetch a conversation between two users with cursor-based pagination. */
    fun getConversation(userId1: Int, userId2: Int, limit: Int = 30, beforeId: Int? = null): List<PrivateMessage> {
        var query = dsl.select(
            PRIVATE_MESSAGES.ID, PRIVATE_MESSAGES.SENDER_ID, PRIVATE_MESSAGES.RECEIVER_ID,
            PRIVATE_MESSAGES.MESSAGE_TYPE, PRIVATE_MESSAGES.CONTENT,
            PRIVATE_MESSAGES.IS_READ, PRIVATE_MESSAGES.CREATED_AT,
            SENDER.USERNAME, SENDER.AVATAR_URL,
            RECEIVER.USERNAME
        )
            .from(PRIVATE_MESSAGES)
            .join(SENDER).on(PRIVATE_MESSAGES.SENDER_ID.eq(SENDER.ID))
            .join(RECEIVER).on(PRIVATE_MESSAGES.RECEIVER_ID.eq(RECEIVER.ID))
            .where(
                PRIVATE_MESSAGES.SENDER_ID.eq(userId1).and(PRIVATE_MESSAGES.RECEIVER_ID.eq(userId2))
                    .or(PRIVATE_MESSAGES.SENDER_ID.eq(userId2).and(PRIVATE_MESSAGES.RECEIVER_ID.eq(userId1)))
            )

        if (beforeId != null) {
            query = query.and(PRIVATE_MESSAGES.ID.lt(beforeId))
        }

        val records = query.orderBy(PRIVATE_MESSAGES.ID.desc())
            .limit(limit)
            .fetch()

        return records.reversed().map(::mapRecord)
    }

    /** Mark all messages from [senderId] to [receiverId] as read. */
    fun markAsRead(senderId: Int, receiverId: Int) {
        dsl.update(PRIVATE_MESSAGES)
            .set(PRIVATE_MESSAGES.IS_READ, true)
            .where(PRIVATE_MESSAGES.SENDER_ID.eq(senderId))
            .and(PRIVATE_MESSAGES.RECEIVER_ID.eq(receiverId))
            .and(PRIVATE_MESSAGES.IS_READ.eq(false))
            .execute()
    }

    /** Total unread count for a user across all conversations. */
    fun getUnreadCount(userId: Int): Int {
        return dsl.selectCount()
            .from(PRIVATE_MESSAGES)
            .where(PRIVATE_MESSAGES.RECEIVER_ID.eq(userId))
            .and(PRIVATE_MESSAGES.IS_READ.eq(false))
            .fetchOne(0, Int::class.java) ?: 0
    }

    /** Unread counts grouped by sender. */
    fun getUnreadSenders(userId: Int): List<UnreadSender> {
        val unreadCount = count().`as`("unread_count")
        return dsl.select(PRIVATE_MESSAGES.SENDER_ID, USERS.USERNAME, unreadCount)
            .from(PRIVATE_MESSAGES)
            .join(USERS).on(USERS.ID.eq(PRIVATE_MESSAGES.SENDER_ID))
            .where(PRIVATE_MESSAGES.RECEIVER_ID.eq(userId))
            .and(PRIVATE_MESSAGES.IS_READ.eq(false))
            .groupBy(PRIVATE_MESSAGES.SENDER_ID, USERS.USERNAME)
            .orderBy(unreadCount.desc(), PRIVATE_MESSAGES.SENDER_ID.asc())
            .fetch { r ->
                UnreadSender(
                    senderId = r.get(PRIVATE_MESSAGES.SENDER_ID)!!,
                    senderUsername = r.get(USERS.USERNAME) ?: "",
                    unreadCount = r.get(unreadCount) ?: 0
                )
            }
    }

    /**
     * DM inbox: one entry per conversation partner, ordered by most recent message.
     */
    fun getInbox(userId: Int): List<DmInboxEntry> {
        val sql = """
            SELECT u.id, u.username, u.avatar_url,
                   pm.message_type, pm.content, pm.created_at, pm.sender_id,
                   COALESCE(uc.unread_count, 0) AS unread_count
            FROM (
                SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS counterpart_id,
                       MAX(id) AS latest_message_id
                FROM private_messages
                WHERE sender_id = ? OR receiver_id = ?
                GROUP BY counterpart_id
            ) lc
            JOIN private_messages pm ON pm.id = lc.latest_message_id
            JOIN users u ON u.id = lc.counterpart_id
            LEFT JOIN (
                SELECT sender_id AS counterpart_id, COUNT(*) AS unread_count
                FROM private_messages
                WHERE receiver_id = ? AND is_read = FALSE
                GROUP BY sender_id
            ) uc ON uc.counterpart_id = u.id
            ORDER BY lc.latest_message_id DESC
        """.trimIndent()

        return dsl.fetch(sql, userId, userId, userId, userId).map { record ->
            val msgType = record.get("message_type", String::class.java) ?: "text"
            val contentJsonb = record.get("content", JSONB::class.java)
            val content = parseContent(contentJsonb)
            val preview = when (msgType) {
                "image" -> "Shared an image"
                "file" -> (content["name"] as? String)?.takeIf { it.isNotBlank() } ?: "Shared a file"
                else -> (content["text"] as? String)?.trim().orEmpty()
            }
            DmInboxEntry(
                userId = record.get("id", Int::class.java)!!,
                username = record.get("username", String::class.java) ?: "",
                avatarUrl = record.get("avatar_url", String::class.java),
                latestMessageType = msgType,
                latestMessagePreview = preview,
                latestMessageTimestamp = record.get("created_at", java.time.OffsetDateTime::class.java).toEpochMillis(),
                latestMessageSenderId = record.get("sender_id", Int::class.java)!!,
                unreadCount = record.get("unread_count", Int::class.java) ?: 0
            )
        }
    }

    // ---- Internal helpers ----

    private fun insertMessage(senderId: Int, receiverId: Int, type: String, content: JSONB): Int {
        return dsl.insertInto(PRIVATE_MESSAGES)
            .set(PRIVATE_MESSAGES.SENDER_ID, senderId)
            .set(PRIVATE_MESSAGES.RECEIVER_ID, receiverId)
            .set(PRIVATE_MESSAGES.MESSAGE_TYPE, type)
            .set(PRIVATE_MESSAGES.CONTENT, content)
            .returningResult(PRIVATE_MESSAGES.ID)
            .fetchOne()!!
            .get(PRIVATE_MESSAGES.ID)!!
    }

    private fun mapRecord(record: Record): PrivateMessage {
        val type = record.get(PRIVATE_MESSAGES.MESSAGE_TYPE) ?: "text"
        val content = parseContent(record.get(PRIVATE_MESSAGES.CONTENT))
        return PrivateMessage(
            id = record.get(PRIVATE_MESSAGES.ID)!!,
            senderId = record.get(PRIVATE_MESSAGES.SENDER_ID)!!,
            senderUsername = record.get(SENDER.USERNAME) ?: "unknown",
            senderAvatarUrl = record.get(SENDER.AVATAR_URL),
            receiverId = record.get(PRIVATE_MESSAGES.RECEIVER_ID)!!,
            receiverUsername = record.get(RECEIVER.USERNAME) ?: "unknown",
            messageType = type,
            content = if (type == "text") content["text"] as? String else null,
            fileUrl = if (type != "text") content["url"] as? String else null,
            fileName = if (type == "file") content["name"] as? String else null,
            fileSize = if (type == "file") (content["size"] as? Number)?.toLong() else null,
            mimeType = if (type == "file") content["mime"] as? String else null,
            thumbnailUrl = if (type == "image") content["thumbnail"] as? String else null,
            width = if (type == "image") (content["width"] as? Number)?.toInt() else null,
            height = if (type == "image") (content["height"] as? Number)?.toInt() else null,
            isRead = record.get(PRIVATE_MESSAGES.IS_READ) ?: false,
            timestamp = record.get(PRIVATE_MESSAGES.CREATED_AT).toEpochMillis()
        )
    }

}
