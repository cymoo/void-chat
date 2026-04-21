package controller
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
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
    private val log = org.slf4j.LoggerFactory.getLogger(ChatController::class.java)

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
        if (!chatService.joinRoom(roomId, conn, currentUser)) {
            conn.send(chatService.serializeEvent(WsEvent.Error("Room is full")))
            conn.close()
            return
        }
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
                currentUser = validateCurrentUser(conn, currentUser) ?: return@onMessage
                val p = objectMapper.readValue<WsPayload>(msg)

                when (p.type) {
                    "text" -> p.content?.let { text ->
                        sendOrBlockError(conn, currentUser.id) {
                            chatService.sendTextMessage(roomId, currentUser, text, p.replyToId)
                        }
                    }
                    "image" -> p.imageUrl?.let { image ->
                        sendOrBlockError(conn, currentUser.id) {
                            chatService.sendImageMessage(roomId, currentUser, image, p.thumbnailUrl, p.width, p.height, p.replyToId)
                        }
                    }
                    "file" -> {
                        if (p.fileName != null && p.fileUrl != null &&
                            p.fileSize != null && p.mimeType != null) {
                            sendOrBlockError(conn, currentUser.id) {
                                chatService.sendFileMessage(
                                    roomId, currentUser, p.fileName, p.fileUrl,
                                    p.fileSize, p.mimeType, p.replyToId
                                )
                            }
                        }
                    }
                    "edit" -> {
                        if (p.messageId != null && p.content != null) {
                            chatService.editMessage(roomId, currentUser, p.messageId, p.content)
                        }
                    }
                    "delete" -> {
                        p.messageId?.let { id ->
                            chatService.deleteMessage(roomId, currentUser, id)
                        }
                    }
                    "load_history" -> {
                        p.beforeId?.let { id ->
                            val (messages, hasMore) = chatService.getOlderMessages(roomId, id)
                            conn.send(chatService.serializeEvent(
                                WsEvent.History(messages, hasMore)
                            ))
                        }
                    }
                    "search" -> {
                        p.query?.let { q ->
                            if (q.isNotBlank()) {
                                val results = chatService.searchMessages(roomId, q)
                                conn.send(chatService.serializeEvent(
                                    WsEvent.SearchResults(results, q)
                                ))
                            }
                        }
                    }
                    "typing" -> {
                        p.isTyping?.let { typing ->
                            chatService.sendTypingStatus(roomId, currentUser, typing)
                        }
                    }
                    "private_message" -> handlePrivateMessage(conn, currentUser, p)
                    "private_history" -> handlePrivateHistory(conn, currentUser, p)
                    "mark_read" -> handleMarkRead(currentUser, p)
                    "set_role" -> {
                        if (p.targetUserId != null && p.role != null) {
                            val ok = chatService.setUserRole(roomId, currentUser, p.targetUserId, p.role)
                            if (!ok) {
                                conn.send(chatService.serializeEvent(WsEvent.Error("Permission denied for role change")))
                            }
                        }
                    }
                    "kick" -> {
                        p.targetUserId?.let { userId ->
                            val ok = chatService.kickUser(roomId, currentUser, userId)
                            if (!ok) {
                                conn.send(chatService.serializeEvent(WsEvent.Error("Permission denied for kick action")))
                            }
                        }
                    }
                    "leave" -> {
                        // Legacy: treat as a no-op; WS close via onClose handles presence cleanup.
                    }
                    "leave_room" -> {
                        // Explicit persistent leave: remove from room membership.
                        if (joinedRoom.compareAndSet(true, false)) {
                            chatService.leaveRoomExplicit(roomId, currentUser)
                        }
                    }
                    "update_profile" -> {
                        currentUser = handleUpdateProfile(currentUser, p) ?: currentUser
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
            log.warn("WebSocket error for user {}: {}", currentUser.username, error.message)
        }
    }

    @Ws("/dm")
    fun directMessages(conn: WsConnection) {
        var currentUser = conn.getStateOrNull<User>("user")
            ?: run {
                conn.send("""{"type":"error","message":"User not authenticated"}""")
                conn.close()
                return
            }

        chatService.attachDirectConnection(currentUser.id, conn)
        conn.send(chatService.serializeEvent(WsEvent.UnreadCounts(chatService.getUnreadDmCount(currentUser.id))))

        conn.onMessage { msg ->
            try {
                currentUser = validateCurrentUser(conn, currentUser) ?: return@onMessage
                val p = objectMapper.readValue<WsPayload>(msg)

                when (p.type) {
                    "private_message" -> handlePrivateMessage(conn, currentUser, p)
                    "private_history" -> handlePrivateHistory(conn, currentUser, p)
                    "mark_read" -> handleMarkRead(currentUser, p)
                    "update_profile" -> {
                        currentUser = handleUpdateProfile(currentUser, p) ?: currentUser
                    }
                }
            } catch (e: Exception) {
                conn.send(objectMapper.writeValueAsString(mapOf(
                    "type" to "error",
                    "message" to "Failed to process message: ${e.message}"
                )))
            }
        }

        conn.onClose { _ ->
            chatService.detachDirectConnection(currentUser.id, conn)
        }

        conn.onError { error ->
            log.warn("WebSocket DM error for user {}: {}", currentUser.username, error.message)
        }
    }

    /** Re-fetches user from DB; closes connection and returns null if disabled/deleted. */
    private fun validateCurrentUser(conn: WsConnection, currentUser: User): User? {
        val latest = userService.getUserById(currentUser.id)
        if (latest == null || latest.isDisabled) {
            conn.send(chatService.serializeEvent(WsEvent.Error("Account is disabled")))
            conn.close()
            return null
        }
        return latest
    }

    /** Attempts to send a message; on block/mute, sends the reason as an error event. */
    private fun sendOrBlockError(conn: WsConnection, userId: Int, send: () -> Boolean) {
        if (!send()) {
            conn.send(chatService.serializeEvent(WsEvent.Error(
                chatService.roomMessageBlockReason(userId) ?: "Message sending is not allowed"
            )))
        }
    }

    private fun handlePrivateMessage(conn: WsConnection, sender: User, p: WsPayload) {
        val targetUserId = p.targetUserId ?: return
        when {
            p.content != null -> {
                chatService.sendPrivateMessage(
                    sender = sender,
                    receiverId = targetUserId,
                    messageType = "text",
                    content = p.content
                )
            }
            p.imageUrl != null -> {
                chatService.sendPrivateMessage(
                    sender = sender,
                    receiverId = targetUserId,
                    messageType = "image",
                    fileUrl = p.imageUrl,
                    thumbnailUrl = p.thumbnailUrl,
                    width = p.width,
                    height = p.height
                )
            }
            p.fileUrl != null && p.fileName != null && p.fileSize != null && p.mimeType != null -> {
                chatService.sendPrivateMessage(
                    sender = sender,
                    receiverId = targetUserId,
                    messageType = "file",
                    fileUrl = p.fileUrl,
                    fileName = p.fileName,
                    fileSize = p.fileSize,
                    mimeType = p.mimeType
                )
            }
        }
    }

    private fun handlePrivateHistory(conn: WsConnection, currentUser: User, p: WsPayload) {
        val userId = p.targetUserId ?: return
        val (messages, hasMore) = chatService.getPrivateHistory(currentUser.id, userId, p.beforeId)
        conn.send(chatService.serializeEvent(WsEvent.PrivateHistory(messages, hasMore)))
    }

    private fun handleMarkRead(currentUser: User, p: WsPayload) {
        val userId = p.targetUserId ?: return
        chatService.markPrivateMessagesRead(currentUser.id, userId)
    }

    /** Returns updated user, or null if nothing changed. */
    private fun handleUpdateProfile(currentUser: User, p: WsPayload): User? {
        val updated = userService.updateProfile(
            userId = currentUser.id,
            username = p.username,
            avatarUrl = p.avatarUrl,
            bio = p.bio,
            status = p.status
        )
        if (updated != null) {
            chatService.broadcastUserUpdate(updated)
        }
        return updated
    }
}
