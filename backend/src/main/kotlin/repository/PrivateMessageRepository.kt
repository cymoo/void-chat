package repository

import chatroom.jooq.generated.Tables.PRIVATE_MESSAGES
import chatroom.jooq.generated.Tables.USERS
import model.DmInboxEntry
import model.PrivateMessage
import model.UnreadSender
import org.jooq.DSLContext
import org.jooq.impl.DSL
import org.jooq.impl.DSL.count
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

class PrivateMessageRepository(private val dsl: DSLContext) {

    private val SENDER = USERS.`as`("sender")
    private val RECEIVER = USERS.`as`("receiver")

    fun saveMessage(
        senderId: Int,
        receiverId: Int,
        messageType: String,
        content: String? = null,
        fileUrl: String? = null,
        fileName: String? = null,
        fileSize: Long? = null,
        mimeType: String? = null,
        thumbnailUrl: String? = null
    ): Int {
        return dsl.insertInto(PRIVATE_MESSAGES)
            .set(PRIVATE_MESSAGES.SENDER_ID, senderId)
            .set(PRIVATE_MESSAGES.RECEIVER_ID, receiverId)
            .set(PRIVATE_MESSAGES.MESSAGE_TYPE, messageType)
            .set(PRIVATE_MESSAGES.CONTENT, content)
            .set(PRIVATE_MESSAGES.FILE_URL, fileUrl)
            .set(PRIVATE_MESSAGES.FILE_NAME, fileName)
            .set(PRIVATE_MESSAGES.FILE_SIZE, fileSize?.let { toSqliteInt(it, "fileSize") })
            .set(PRIVATE_MESSAGES.MIME_TYPE, mimeType)
            .set(PRIVATE_MESSAGES.THUMBNAIL_URL, thumbnailUrl)
            .returningResult(PRIVATE_MESSAGES.ID)
            .fetchOne()!!
            .get(PRIVATE_MESSAGES.ID)!!
    }

    fun getConversation(userId1: Int, userId2: Int, limit: Int = 30, beforeId: Int? = null): List<PrivateMessage> {
        var query = dsl.select(
            PRIVATE_MESSAGES.ID, PRIVATE_MESSAGES.SENDER_ID, PRIVATE_MESSAGES.RECEIVER_ID,
            PRIVATE_MESSAGES.MESSAGE_TYPE, PRIVATE_MESSAGES.CONTENT, PRIVATE_MESSAGES.FILE_URL,
            PRIVATE_MESSAGES.FILE_NAME, PRIVATE_MESSAGES.FILE_SIZE, PRIVATE_MESSAGES.MIME_TYPE,
            PRIVATE_MESSAGES.THUMBNAIL_URL, PRIVATE_MESSAGES.IS_READ, PRIVATE_MESSAGES.CREATED_AT,
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

        // Cursor is based on message ID, so ordering by ID keeps pagination stable.
        val records = query.orderBy(PRIVATE_MESSAGES.ID.desc())
            .limit(limit)
            .fetch()

        return records.reversed().map { record ->
            PrivateMessage(
                id = record.get(PRIVATE_MESSAGES.ID)!!,
                senderId = record.get(PRIVATE_MESSAGES.SENDER_ID)!!,
                senderUsername = record.get(SENDER.USERNAME) ?: "unknown",
                senderAvatarUrl = record.get(SENDER.AVATAR_URL),
                receiverId = record.get(PRIVATE_MESSAGES.RECEIVER_ID)!!,
                receiverUsername = record.get(RECEIVER.USERNAME) ?: "unknown",
                messageType = record.get(PRIVATE_MESSAGES.MESSAGE_TYPE) ?: "text",
                content = record.get(PRIVATE_MESSAGES.CONTENT),
                fileUrl = record.get(PRIVATE_MESSAGES.FILE_URL),
                fileName = record.get(PRIVATE_MESSAGES.FILE_NAME),
                fileSize = record.get(PRIVATE_MESSAGES.FILE_SIZE)?.toLong(),
                mimeType = record.get(PRIVATE_MESSAGES.MIME_TYPE),
                thumbnailUrl = record.get(PRIVATE_MESSAGES.THUMBNAIL_URL),
                isRead = (record.get(PRIVATE_MESSAGES.IS_READ) ?: 0) == 1,
                timestamp = parseTimestamp(record.get(PRIVATE_MESSAGES.CREATED_AT))
            )
        }
    }

    fun markAsRead(senderId: Int, receiverId: Int) {
        dsl.update(PRIVATE_MESSAGES)
            .set(PRIVATE_MESSAGES.IS_READ, 1)
            .where(PRIVATE_MESSAGES.SENDER_ID.eq(senderId))
            .and(PRIVATE_MESSAGES.RECEIVER_ID.eq(receiverId))
            .and(PRIVATE_MESSAGES.IS_READ.eq(0))
            .execute()
    }

    fun getUnreadCount(userId: Int): Int {
        return dsl.selectCount()
            .from(PRIVATE_MESSAGES)
            .where(PRIVATE_MESSAGES.RECEIVER_ID.eq(userId))
            .and(PRIVATE_MESSAGES.IS_READ.eq(0))
            .fetchOne(0, Int::class.java) ?: 0
    }

    fun getUnreadSenders(userId: Int): List<UnreadSender> {
        val unreadCount = count().`as`("unread_count")
        return dsl.select(
            PRIVATE_MESSAGES.SENDER_ID,
            USERS.USERNAME,
            unreadCount
        )
            .from(PRIVATE_MESSAGES)
            .join(USERS).on(USERS.ID.eq(PRIVATE_MESSAGES.SENDER_ID))
            .where(PRIVATE_MESSAGES.RECEIVER_ID.eq(userId))
            .and(PRIVATE_MESSAGES.IS_READ.eq(0).or(PRIVATE_MESSAGES.IS_READ.isNull))
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

    fun getInbox(userId: Int): List<DmInboxEntry> {
        val counterpartId = DSL.field(
            "case when {0} = {1} then {2} else {0} end",
            Int::class.java,
            PRIVATE_MESSAGES.SENDER_ID,
            DSL.inline(userId),
            PRIVATE_MESSAGES.RECEIVER_ID
        )

        val latestMessageId = DSL.max(PRIVATE_MESSAGES.ID).`as`("latest_message_id")
        val latestConversations = dsl.select(
            counterpartId.`as`("counterpart_id"),
            latestMessageId
        )
            .from(PRIVATE_MESSAGES)
            .where(PRIVATE_MESSAGES.SENDER_ID.eq(userId).or(PRIVATE_MESSAGES.RECEIVER_ID.eq(userId)))
            .groupBy(counterpartId)
            .asTable("latest_conversations")

        val unreadCount = count().`as`("unread_count")
        val unreadCounts = dsl.select(
            PRIVATE_MESSAGES.SENDER_ID.`as`("counterpart_id"),
            unreadCount
        )
            .from(PRIVATE_MESSAGES)
            .where(PRIVATE_MESSAGES.RECEIVER_ID.eq(userId))
            .and(PRIVATE_MESSAGES.IS_READ.eq(0).or(PRIVATE_MESSAGES.IS_READ.isNull))
            .groupBy(PRIVATE_MESSAGES.SENDER_ID)
            .asTable("unread_counts")

        val latestConversationCounterpartId = latestConversations.field("counterpart_id", Int::class.java)!!
        val latestConversationMessageId = latestConversations.field("latest_message_id", Int::class.java)!!
        val unreadConversationCounterpartId = unreadCounts.field("counterpart_id", Int::class.java)!!
        val unreadConversationCount = unreadCounts.field("unread_count", Int::class.java)!!

        return dsl.select(
            USERS.ID,
            USERS.USERNAME,
            USERS.AVATAR_URL,
            PRIVATE_MESSAGES.MESSAGE_TYPE,
            PRIVATE_MESSAGES.CONTENT,
            PRIVATE_MESSAGES.FILE_NAME,
            PRIVATE_MESSAGES.CREATED_AT,
            PRIVATE_MESSAGES.SENDER_ID,
            unreadConversationCount
        )
            .from(latestConversations)
            .join(PRIVATE_MESSAGES).on(PRIVATE_MESSAGES.ID.eq(latestConversationMessageId))
            .join(USERS).on(USERS.ID.eq(latestConversationCounterpartId))
            .leftJoin(unreadCounts).on(unreadConversationCounterpartId.eq(USERS.ID))
            .orderBy(latestConversationMessageId.desc())
            .fetch { record ->
                val latestMessageType = record.get(PRIVATE_MESSAGES.MESSAGE_TYPE) ?: "text"
                val latestMessagePreview = when (latestMessageType) {
                    "image" -> record.get(PRIVATE_MESSAGES.FILE_NAME)?.takeIf { it.isNotBlank() } ?: "Shared an image"
                    "file" -> record.get(PRIVATE_MESSAGES.FILE_NAME)?.takeIf { it.isNotBlank() } ?: "Shared a file"
                    else -> record.get(PRIVATE_MESSAGES.CONTENT)?.trim().orEmpty()
                }

                DmInboxEntry(
                    userId = record.get(USERS.ID)!!,
                    username = record.get(USERS.USERNAME) ?: "",
                    avatarUrl = record.get(USERS.AVATAR_URL),
                    latestMessageType = latestMessageType,
                    latestMessagePreview = latestMessagePreview,
                    latestMessageTimestamp = parseTimestamp(record.get(PRIVATE_MESSAGES.CREATED_AT)),
                    latestMessageSenderId = record.get(PRIVATE_MESSAGES.SENDER_ID)!!,
                    unreadCount = record.get(unreadConversationCount) ?: 0
                )
            }
    }

    private fun parseTimestamp(timestamp: LocalDateTime?): Long {
        return timestamp?.toInstant(ZoneOffset.UTC)?.toEpochMilli()
            ?: Instant.now().toEpochMilli()
    }

    private fun toSqliteInt(value: Long, fieldName: String): Int {
        require(value in Int.MIN_VALUE.toLong()..Int.MAX_VALUE.toLong()) {
            "$fieldName out of supported range for this schema: $value"
        }
        return value.toInt()
    }
}
