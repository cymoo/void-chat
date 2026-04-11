package controller
import com.fasterxml.jackson.databind.ObjectMapper
import io.github.cymoo.colleen.Context
import io.github.cymoo.colleen.Controller
import io.github.cymoo.colleen.Next
import io.github.cymoo.colleen.ws.Ws
import io.github.cymoo.colleen.ws.WsConnection
import io.github.cymoo.colleen.ws.WsUse
import model.User
import model.WsEvent
import java.util.concurrent.atomic.AtomicBoolean
import service.ChatService
import service.RoomService
import service.SessionService
import service.UserService

/**
 * WebSocket chat controller
 */
@Controller("/chat")
class ChatController(
    private val userService: UserService,
    private val chatService: ChatService,
    private val roomService: RoomService,
    private val sessionService: SessionService,
    private val objectMapper: ObjectMapper
) {

    @WsUse
    fun validateUser(ctx: Context, next: Next) {
        val token = ctx.query("token")
        if (token.isNullOrBlank()) {
            ctx.status(401).json(mapOf("error" to "Authentication required"))
            return
        }

        val userId = sessionService.validateSession(token)
        if (userId == null) {
            ctx.status(401).json(mapOf("error" to "Invalid or expired session"))
            return
        }

        val user = userService.getUserById(userId)
        if (user == null) {
            ctx.status(401).json(mapOf("error" to "User not found"))
            return
        }
        if (user.isDisabled) {
            ctx.status(401).json(mapOf("error" to "Account is disabled"))
            return
        }

        ctx.setState("user", user)
        next()
    }

    @Ws("/{roomId}")
    fun chatRoom(conn: WsConnection) {
        val roomId = conn.pathParam("roomId")?.toIntOrNull()
            ?: run {
                conn.send("""{"type":"error","message":"Invalid room ID"}""")
                conn.close()
                return
            }

        // Mutable reference so profile updates are reflected in subsequent messages
        var currentUser = conn.getStateOrNull<User>("user")
            ?: run {
                conn.send("""{"type":"error","message":"User not authenticated"}""")
                conn.close()
                return
            }
        var joinedRoom = AtomicBoolean(false)

        // Verify room exists
        val room = roomService.getRoomById(roomId)
            ?: run {
                conn.send("""{"type":"error","message":"Room not found"}""")
                conn.close()
                return
            }

        // Verify password for private rooms
        if (room.isPrivate) {
            val roomPassword = conn.query("roomPassword")
            if (!roomService.verifyRoomPassword(roomId, roomPassword)) {
                conn.send("""{"type":"error","message":"Incorrect room password"}""")
                conn.close()
                return
            }
        }

        // Join room
        chatService.joinRoom(roomId, conn, currentUser)
        joinedRoom.set(true)

        // Send message history with hasMore flag
        val history = chatService.getMessageHistory(roomId)
        val hasMore = history.size >= 30
        conn.send(chatService.serializeEvent(
            WsEvent.History(history, hasMore)
        ))

        // Send current users
        val users = chatService.getRoomUsers(roomId)
        conn.send(chatService.serializeEvent(
            WsEvent.Users(users)
        ))

        // Send initial unread DM count
        val unreadCount = chatService.getUnreadDmCount(currentUser.id)
        conn.send(chatService.serializeEvent(WsEvent.UnreadCounts(unreadCount)))

        // Handle incoming messages
        conn.onMessage { msg ->
            try {
                val latestUser = userService.getUserById(currentUser.id)
                if (latestUser == null || latestUser.isDisabled) {
                    conn.send(chatService.serializeEvent(WsEvent.Error("Account is disabled")))
                    conn.close()
                    return@onMessage
                }
                currentUser = latestUser

                val payload = objectMapper.readTree(msg)
                val type = payload.path("type").asText("")
                val content = payload.path("content").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val imageUrl = payload.path("imageUrl").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val thumbnailUrl = payload.path("thumbnailUrl").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val fileName = payload.path("fileName").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val fileUrl = payload.path("fileUrl").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val mimeType = payload.path("mimeType").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val messageId = payload.path("messageId").takeIf { !it.isMissingNode && !it.isNull }?.asInt()
                val targetUserId = payload.path("targetUserId").takeIf { !it.isMissingNode && !it.isNull }?.asInt()
                val replyToId = payload.path("replyToId").takeIf { !it.isMissingNode && !it.isNull }?.asInt()
                val beforeId = payload.path("beforeId").takeIf { !it.isMissingNode && !it.isNull }?.asInt()
                val query = payload.path("query").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val role = payload.path("role").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val avatarUrl = payload.path("avatarUrl").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val bio = payload.path("bio").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val status = payload.path("status").takeIf { !it.isMissingNode && !it.isNull }?.asText()
                val fileSize = payload.path("fileSize").takeIf { !it.isMissingNode && !it.isNull }?.asLong()
                val isTyping = payload.path("isTyping").takeIf { !it.isMissingNode && !it.isNull }?.asBoolean()

                when (type) {
                    "text" -> {
                        content?.let { text ->
                            val sent = chatService.sendTextMessage(roomId, currentUser, text, replyToId)
                            if (!sent) {
                                conn.send(chatService.serializeEvent(WsEvent.Error(
                                    chatService.roomMessageBlockReason(currentUser.id)
                                        ?: "Message sending is not allowed"
                                )))
                            }
                        }
                    }
                    "image" -> {
                        imageUrl?.let { image ->
                            val sent = chatService.sendImageMessage(roomId, currentUser, image, thumbnailUrl, replyToId)
                            if (!sent) {
                                conn.send(chatService.serializeEvent(WsEvent.Error(
                                    chatService.roomMessageBlockReason(currentUser.id)
                                        ?: "Message sending is not allowed"
                                )))
                            }
                        }
                    }
                    "file" -> {
                        if (fileName != null && fileUrl != null &&
                            fileSize != null && mimeType != null) {
                            val sent = chatService.sendFileMessage(
                                roomId, currentUser, fileName, fileUrl,
                                fileSize, mimeType, replyToId
                            )
                            if (!sent) {
                                conn.send(chatService.serializeEvent(WsEvent.Error(
                                    chatService.roomMessageBlockReason(currentUser.id)
                                        ?: "Message sending is not allowed"
                                )))
                            }
                        }
                    }
                    "edit" -> {
                        if (messageId != null && content != null) {
                            chatService.editMessage(roomId, currentUser, messageId, content)
                        }
                    }
                    "delete" -> {
                        messageId?.let { id ->
                            chatService.deleteMessage(roomId, currentUser, id)
                        }
                    }
                    "load_history" -> {
                        beforeId?.let { id ->
                            val (messages, hasMore) = chatService.getOlderMessages(roomId, id)
                            conn.send(chatService.serializeEvent(
                                WsEvent.History(messages, hasMore)
                            ))
                        }
                    }
                    "search" -> {
                        query?.let { q ->
                            if (q.isNotBlank()) {
                                val results = chatService.searchMessages(roomId, q)
                                conn.send(chatService.serializeEvent(
                                    WsEvent.SearchResults(results, q)
                                ))
                            }
                        }
                    }
                    "typing" -> {
                        isTyping?.let { typing ->
                            chatService.sendTypingStatus(roomId, currentUser, typing)
                        }
                    }
                    "private_message" -> {
                        if (targetUserId != null) {
                            when {
                                content != null -> {
                                    chatService.sendPrivateMessage(
                                        sender = currentUser,
                                        receiverId = targetUserId,
                                        messageType = "text",
                                        content = content
                                    )
                                }
                                imageUrl != null -> {
                                    chatService.sendPrivateMessage(
                                        sender = currentUser,
                                        receiverId = targetUserId,
                                        messageType = "image",
                                        fileUrl = imageUrl,
                                        thumbnailUrl = thumbnailUrl
                                    )
                                }
                                fileUrl != null && fileName != null && fileSize != null && mimeType != null -> {
                                    chatService.sendPrivateMessage(
                                        sender = currentUser,
                                        receiverId = targetUserId,
                                        messageType = "file",
                                        fileUrl = fileUrl,
                                        fileName = fileName,
                                        fileSize = fileSize,
                                        mimeType = mimeType
                                    )
                                }
                            }
                        }
                    }
                    "private_history" -> {
                        targetUserId?.let { userId ->
                            val (messages, hasMore) = chatService.getPrivateHistory(currentUser.id, userId, beforeId)
                            conn.send(chatService.serializeEvent(
                                WsEvent.PrivateHistory(messages, hasMore)
                            ))
                        }
                    }
                    "mark_read" -> {
                        targetUserId?.let { userId ->
                            chatService.markPrivateMessagesRead(currentUser.id, userId)
                        }
                    }
                    "set_role" -> {
                        if (targetUserId != null && role != null) {
                            val ok = chatService.setUserRole(roomId, currentUser, targetUserId, role)
                            if (!ok) {
                                conn.send(chatService.serializeEvent(WsEvent.Error("Permission denied for role change")))
                            }
                        }
                    }
                    "kick" -> {
                        targetUserId?.let { userId ->
                            val ok = chatService.kickUser(roomId, currentUser, userId)
                            if (!ok) {
                                conn.send(chatService.serializeEvent(WsEvent.Error("Permission denied for kick action")))
                            }
                        }
                    }
                    "leave" -> {
                        if (joinedRoom.compareAndSet(true, false)) {
                            chatService.leaveRoom(roomId, currentUser, conn)
                        }
                    }
                    "update_profile" -> {
                        // Update currentUser so subsequent messages carry the new avatar/status
                        currentUser = chatService.updateUserProfile(
                            currentUser, avatarUrl, bio, status
                        )
                    }
                }
            } catch (e: Exception) {
                conn.send(objectMapper.writeValueAsString(mapOf(
                    "type" to "error",
                    "message" to "Failed to process message: ${e.message}"
                )))
            }
        }

        // Handle disconnect
        conn.onClose { reason ->
            if (joinedRoom.compareAndSet(true, false)) {
                chatService.leaveRoom(roomId, currentUser, conn)
            }
        }

        conn.onError { error ->
            println("WebSocket error for user ${currentUser.username}: ${error.message}")
        }
    }
}
