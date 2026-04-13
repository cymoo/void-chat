package service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import io.github.cymoo.colleen.ws.WsConnection
import model.*
import org.jooq.DSLContext
import repository.MessageRepository
import repository.PrivateMessageRepository
import repository.RoomMemberRepository
import repository.RoomRepository
import repository.UserRepository
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Chat service managing rooms, connections, and message broadcasting
 */
class ChatService(dsl: DSLContext, private val objectMapper: ObjectMapper) {

    private val messageRepo = MessageRepository(dsl)
    private val roomMemberRepo = RoomMemberRepository(dsl)
    private val roomRepo = RoomRepository(dsl)
    private val userRepo = UserRepository(dsl)
    private val privateMessageRepo = PrivateMessageRepository(dsl)
    private val authorizationService = AuthorizationService()

    // Room ID -> Set of WS connections
    private val roomConnections = ConcurrentHashMap<Int, CopyOnWriteArraySet<WsConnection>>()

    // Room ID -> (User ID -> active connection count in this room)
    private val roomUserConnectionCounts = ConcurrentHashMap<Int, ConcurrentHashMap<Int, Int>>()

    // User ID -> Connection
    private val userConnections = ConcurrentHashMap<Int, WsConnection>()

    // Per-(roomId, userId) lock objects to serialise concurrent join/leave for
    // the same user in the same room.  Without this a rapid reconnect (e.g.
    // React Strict-Mode double-mount) can interleave a leaveRoom inside a
    // joinRoom, producing spurious "left" / "joined" broadcasts.
    private val userRoomLocks = ConcurrentHashMap<Pair<Int, Int>, Any>()
    private fun userRoomLock(roomId: Int, userId: Int): Any =
        userRoomLocks.computeIfAbsent(Pair(roomId, userId)) { Any() }

    private val roomLocks = ConcurrentHashMap<Int, Any>()
    private fun roomLock(roomId: Int): Any = roomLocks.computeIfAbsent(roomId) { Any() }

    // Broadcast executor for async message sending
    private val broadcastExecutor: ExecutorService = Executors.newCachedThreadPool { runnable ->
        Thread(runnable).apply {
            isDaemon = true
            name = "chat-broadcast"
        }
    }

    fun joinRoom(roomId: Int, connection: WsConnection, user: User): Boolean {
        // Serialise join/leave for the same user+room so the count check and the
        // DB write + broadcast happen atomically relative to each other.
        // This prevents a racing leaveRoom from interleaving inside joinRoom and
        // producing spurious "left"/"joined" system messages.
        data class JoinWork(
            val joinedUser: User,
            val joinMessage: ChatMessage.System,
            val allUsers: List<User>,
        )

        data class JoinResult(
            val joined: Boolean,
            val work: JoinWork? = null,
        )

        val result: JoinResult = synchronized(userRoomLock(roomId, user.id)) {
            synchronized(roomLock(roomId)) {
                val userCounts = roomUserConnectionCounts.computeIfAbsent(roomId) { ConcurrentHashMap() }
                val existingCount = userCounts[user.id]
                val isNewOccupant = existingCount == null
                val maxUsers = roomRepo.findById(roomId)?.maxUsers ?: Int.MAX_VALUE

                if (isNewOccupant && userCounts.size >= maxUsers) {
                    return@synchronized JoinResult(joined = false)
                }

                val connections = roomConnections.computeIfAbsent(roomId) { CopyOnWriteArraySet() }
                connections.add(connection)
                userConnections[user.id] = connection

                val activeCount = userCounts.merge(user.id, 1) { prev, _ -> prev + 1 } ?: 1

                // Only the first active connection triggers the join broadcast.
                if (activeCount != 1) return@synchronized JoinResult(joined = true)

                val isRoomOwner = roomRepo.findById(roomId)?.creatorId == user.id
                val desiredRole = if (isRoomOwner) AuthorizationService.ROOM_ROLE_OWNER else AuthorizationService.ROOM_ROLE_MEMBER
                roomMemberRepo.addMember(roomId, user.id, desiredRole)
                if (isRoomOwner && roomMemberRepo.getMemberRole(roomId, user.id) != AuthorizationService.ROOM_ROLE_OWNER) {
                    roomMemberRepo.updateMemberRole(roomId, user.id, AuthorizationService.ROOM_ROLE_OWNER)
                }
                userRepo.updateLastSeen(user.id)

                val allUsers = getRoomUsers(roomId)
                val joinedUser = allUsers.find { it.id == user.id } ?: user.copy(role = desiredRole)

                val systemMessageId = messageRepo.saveSystemMessage(
                    roomId,
                    "${user.username} joined the room"
                )
                val joinMessage = ChatMessage.System(
                    id = systemMessageId,
                    content = "${user.username} joined the room",
                    timestamp = System.currentTimeMillis()
                )

                JoinResult(joined = true, work = JoinWork(joinedUser, joinMessage, allUsers))
            }
        }

        // Broadcasts happen outside the lock — they're async and must not hold
        // the per-user lock while waiting for the thread pool.
        if (!result.joined) return false
        if (result.work != null) {
            broadcastToRoom(roomId, WsEvent.Message(result.work.joinMessage))
            broadcastToRoom(roomId, WsEvent.UserJoined(result.work.joinedUser))
            broadcastToRoom(roomId, WsEvent.Users(result.work.allUsers))
        }
        return true
    }

    fun attachDirectConnection(userId: Int, connection: WsConnection) {
        userConnections[userId] = connection
    }

    fun detachDirectConnection(userId: Int, connection: WsConnection) {
        if (userConnections[userId] == connection) {
            userConnections.remove(userId)
        }
    }

    fun leaveRoom(roomId: Int, user: User, connection: WsConnection) {
        // Guard: if the connection was already removed, this is a duplicate call.
        val wasPresent = roomConnections[roomId]?.remove(connection) ?: false
        if (!wasPresent) return

        if (userConnections[user.id] == connection) {
            userConnections.remove(user.id)
        }

        data class LeaveWork(val leaveMessage: ChatMessage.System)

        val work: LeaveWork? = synchronized(userRoomLock(roomId, user.id)) {
            synchronized(roomLock(roomId)) {
                val userCounts = roomUserConnectionCounts[roomId]
                val remainingConnections = userCounts?.compute(user.id) { _, count ->
                    if (count == null || count <= 1) null else count - 1
                }

                // Only broadcast the leave when no active connections remain.
                if (remainingConnections != null) return@synchronized null

                roomMemberRepo.removeMember(roomId, user.id)

                val systemMessageId = messageRepo.saveSystemMessage(
                    roomId,
                    "${user.username} left the room"
                )
                val leaveMessage = ChatMessage.System(
                    id = systemMessageId,
                    content = "${user.username} left the room",
                    timestamp = System.currentTimeMillis()
                )

                LeaveWork(leaveMessage)
            }
        }

        if (work != null) {
            broadcastToRoom(roomId, WsEvent.Message(work.leaveMessage))
            broadcastToRoom(roomId, WsEvent.UserLeft(user.id, user.username))
            broadcastToRoom(roomId, WsEvent.Users(getRoomUsers(roomId)))
        }

        // Clean up empty room tracking.
        if (roomConnections[roomId]?.isEmpty() == true) {
            roomConnections.remove(roomId)
        }
        val userCounts = roomUserConnectionCounts[roomId]
        if (userCounts?.isEmpty() == true) {
            roomUserConnectionCounts.remove(roomId)
        }
    }

    fun sendTextMessage(roomId: Int, user: User, content: String, replyToId: Int? = null): Boolean {
        if (roomMessageBlockReason(user.id) != null) return false
        val messageId = messageRepo.saveTextMessage(roomId, user.id, content, replyToId)

        val replyInfo = if (replyToId != null) getReplyInfoById(replyToId) else null

        val message = ChatMessage.Text(
            id = messageId,
            userId = user.id,
            username = user.username,
            avatarUrl = user.avatarUrl,
            content = content,
            timestamp = System.currentTimeMillis(),
            replyTo = replyInfo
        )

        broadcastToRoom(roomId, WsEvent.Message(message))

        // Parse mentions
        parseMentions(content, roomId, messageId, user.username)
        return true
    }

    fun sendImageMessage(roomId: Int, user: User, imageUrl: String, thumbnailUrl: String?, replyToId: Int? = null): Boolean {
        if (roomMessageBlockReason(user.id) != null) return false
        val messageId = messageRepo.saveImageMessage(roomId, user.id, imageUrl, thumbnailUrl, replyToId)

        val replyInfo = if (replyToId != null) getReplyInfoById(replyToId) else null

        val message = ChatMessage.Image(
            id = messageId,
            userId = user.id,
            username = user.username,
            avatarUrl = user.avatarUrl,
            imageUrl = imageUrl,
            thumbnailUrl = thumbnailUrl,
            timestamp = System.currentTimeMillis(),
            replyTo = replyInfo
        )

        broadcastToRoom(roomId, WsEvent.Message(message))
        return true
    }

    fun sendFileMessage(
        roomId: Int,
        user: User,
        fileName: String,
        fileUrl: String,
        fileSize: Long,
        mimeType: String,
        replyToId: Int? = null
    ): Boolean {
        if (roomMessageBlockReason(user.id) != null) return false
        val messageId = messageRepo.saveFileMessage(
            roomId, user.id, fileName, fileUrl, fileSize, mimeType, replyToId
        )

        val replyInfo = if (replyToId != null) getReplyInfoById(replyToId) else null

        val message = ChatMessage.File(
            id = messageId,
            userId = user.id,
            username = user.username,
            avatarUrl = user.avatarUrl,
            fileName = fileName,
            fileUrl = fileUrl,
            fileSize = fileSize,
            mimeType = mimeType,
            timestamp = System.currentTimeMillis(),
            replyTo = replyInfo
        )

        broadcastToRoom(roomId, WsEvent.Message(message))
        return true
    }

    fun editMessage(roomId: Int, user: User, messageId: Int, newContent: String) {
        if (messageRepo.updateMessage(messageId, user.id, newContent)) {
            val editedAt = System.currentTimeMillis()
            broadcastToRoom(roomId, WsEvent.MessageEdited(messageId, newContent, editedAt))
        }
    }

    fun deleteMessage(roomId: Int, user: User, messageId: Int) {
        val roomRole = roomMemberRepo.getMemberRole(roomId, user.id)
        val deleted = if (authorizationService.canDeleteAnyMessage(user, roomRole)) {
            messageRepo.adminDeleteMessage(messageId)
        } else {
            messageRepo.softDeleteMessage(messageId, user.id)
        }

        if (deleted) {
            broadcastToRoom(roomId, WsEvent.MessageDeleted(messageId))
        }
    }

    fun getMessageHistory(roomId: Int): List<ChatMessage> {
        return messageRepo.getRecentMessages(roomId, 30)
    }

    fun getOlderMessages(roomId: Int, beforeId: Int, limit: Int = 30): Pair<List<ChatMessage>, Boolean> {
        val messages = messageRepo.getMessagesBefore(roomId, beforeId, limit + 1)
        val hasMore = messages.size > limit
        return Pair(if (hasMore) messages.drop(1) else messages, hasMore)
    }

    fun searchMessages(roomId: Int, query: String): List<ChatMessage> {
        return messageRepo.searchMessages(roomId, query)
    }

    fun getRoomUsers(roomId: Int): List<User> {
        return roomMemberRepo.getRoomMembers(roomId)
    }

    /** Returns the number of online users per room based on active WebSocket connections. */
    fun getOnlineUserCounts(): Map<Int, Int> {
        return roomUserConnectionCounts.mapValues { (_, userCounts) -> userCounts.size }
    }

    /** Exposed for testing: returns the broadcast executor so tests can await pending tasks. */
    internal fun broadcastExecutorForTest(): ExecutorService = broadcastExecutor

    // Private messaging
    fun sendPrivateMessage(
        sender: User,
        receiverId: Int,
        messageType: String,
        content: String? = null,
        fileUrl: String? = null,
        fileName: String? = null,
        fileSize: Long? = null,
        mimeType: String? = null,
        thumbnailUrl: String? = null
    ) {
        val messageId = privateMessageRepo.saveMessage(
            senderId = sender.id,
            receiverId = receiverId,
            messageType = messageType,
            content = content,
            fileUrl = fileUrl,
            fileName = fileName,
            fileSize = fileSize,
            mimeType = mimeType,
            thumbnailUrl = thumbnailUrl
        )
        val receiver = userRepo.findById(receiverId) ?: return

        val pm = PrivateMessage(
            id = messageId,
            senderId = sender.id,
            senderUsername = sender.username,
            senderAvatarUrl = sender.avatarUrl,
            receiverId = receiverId,
            receiverUsername = receiver.username,
            messageType = messageType,
            content = content,
            fileUrl = fileUrl,
            fileName = fileName,
            fileSize = fileSize,
            mimeType = mimeType,
            thumbnailUrl = thumbnailUrl,
            timestamp = System.currentTimeMillis()
        )

        // Send to receiver
        val receiverConn = userConnections[receiverId]
        if (receiverConn != null) {
            runCatching { receiverConn.send(serializeEvent(WsEvent.PrivateMessageEvent(pm))) }
            // Don't push UnreadCounts here — the frontend increments its own
            // counter when a private_message arrives outside an active chat.
            // Pushing the DB count would overwrite the frontend's correct value
            // when the receiver is currently viewing this conversation (messages
            // are saved as is_read=0 until the chat is closed via mark_read).
        }
        // If offline — unread count will be picked up on next connect

        // Send to sender (confirmation)
        val senderConn = userConnections[sender.id]
        if (senderConn != null) {
            runCatching { senderConn.send(serializeEvent(WsEvent.PrivateMessageEvent(pm))) }
        }
    }

    fun getPrivateHistory(userId1: Int, userId2: Int, beforeId: Int? = null): Pair<List<PrivateMessage>, Boolean> {
        val messages = privateMessageRepo.getConversation(userId1, userId2, 31, beforeId)
        val hasMore = messages.size > 30
        // Mark messages from userId2 to userId1 as read
        privateMessageRepo.markAsRead(userId2, userId1)
        // Notify sender of updated unread count
        sendToUser(userId1, WsEvent.UnreadCounts(privateMessageRepo.getUnreadCount(userId1)))
        return Pair(if (hasMore) messages.drop(1) else messages, hasMore)
    }

    fun getUnreadDmCount(userId: Int): Int = privateMessageRepo.getUnreadCount(userId)

    fun getUnreadDmSenders(userId: Int): List<UnreadSender> = privateMessageRepo.getUnreadSenders(userId)

    fun getDmInbox(userId: Int): List<DmInboxEntry> = privateMessageRepo.getInbox(userId)

    fun markPrivateMessagesRead(currentUserId: Int, senderId: Int) {
        privateMessageRepo.markAsRead(senderId, currentUserId)
        sendToUser(currentUserId, WsEvent.UnreadCounts(privateMessageRepo.getUnreadCount(currentUserId)))
    }

    fun sendTypingStatus(roomId: Int, user: User, isTyping: Boolean) {
        broadcastToRoom(roomId, WsEvent.Typing(user.id, user.username, isTyping))
    }

    fun roomMessageBlockReason(userId: Int): String? {
        val latestUser = userRepo.findById(userId) ?: return "User not found"
        if (latestUser.isDisabled) return "Account is disabled"
        if (latestUser.isMuted) return "You are muted and cannot send room messages"
        return null
    }

    // Room permissions
    fun setUserRole(roomId: Int, actorUser: User, targetUserId: Int, role: String): Boolean {
        val actorRoomRole = roomMemberRepo.getMemberRole(roomId, actorUser.id)
        if (!authorizationService.canManageRoomRoles(actorUser, actorRoomRole)) return false

        val desiredRole = role.trim().lowercase()
        if (!authorizationService.isValidAssignableRoomRole(desiredRole)) return false

        val targetCurrentRole = roomMemberRepo.getMemberRole(roomId, targetUserId) ?: return false
        if (authorizationService.normalizeRoomRole(targetCurrentRole) == AuthorizationService.ROOM_ROLE_OWNER &&
            !authorizationService.isPlatformAdmin(actorUser)
        ) {
            return false
        }

        roomMemberRepo.updateMemberRole(roomId, targetUserId, desiredRole)
        broadcastToRoom(roomId, WsEvent.RoleChanged(targetUserId, desiredRole))
        return true
    }

    fun kickUser(roomId: Int, actorUser: User, targetUserId: Int, reason: String = "Kicked by admin"): Boolean {
        val actorRoomRole = roomMemberRepo.getMemberRole(roomId, actorUser.id)
        if (!authorizationService.canKickUsers(actorUser, actorRoomRole)) return false

        val targetRole = roomMemberRepo.getMemberRole(roomId, targetUserId)
        if (authorizationService.normalizeRoomRole(targetRole) == AuthorizationService.ROOM_ROLE_OWNER &&
            !authorizationService.isPlatformAdmin(actorUser)
        ) {
            return false
        }

        roomMemberRepo.removeMember(roomId, targetUserId)

        val targetConn = userConnections[targetUserId]
        if (targetConn != null) {
            runCatching {
                targetConn.send(serializeEvent(WsEvent.Kicked(reason)))
                targetConn.close()
            }
        }

        broadcastToRoom(roomId, WsEvent.Users(getRoomUsers(roomId)))
        return true
    }

    fun broadcastUserUpdate(updatedUser: User) {
        // Broadcast to all rooms the user is in
        for ((roomId, _) in roomConnections) {
            val roomRole = roomMemberRepo.getMemberRole(roomId, updatedUser.id) ?: continue
            val roomScopedUser = updatedUser.copy(role = roomRole)
            broadcastToRoom(roomId, WsEvent.UserUpdated(roomScopedUser))
        }
    }

    private fun parseMentions(content: String, roomId: Int, messageId: Int, mentionedBy: String) {
        val mentionPattern = Regex("@(\\w+)")
        val mentions = mentionPattern.findAll(content).map { it.groupValues[1] }.toList()

        if (mentions.isEmpty()) return

        val roomUsers = getRoomUsers(roomId)
        mentions.forEach { username ->
            val mentionedUser = roomUsers.find { it.username == username }
            if (mentionedUser != null) {
                val conn = userConnections[mentionedUser.id]
                if (conn != null) {
                    runCatching {
                        conn.send(serializeEvent(WsEvent.Mention(messageId, mentionedBy, content)))
                    }
                }
            }
        }
    }

    private fun getReplyInfoById(messageId: Int): ReplyInfo? {
        return messageRepo.getReplyInfo(messageId)
    }

    fun broadcastToRoom(roomId: Int, event: WsEvent) {
        val connections = roomConnections[roomId] ?: return
        val eventJson = serializeEvent(event)

        // Take snapshot and broadcast asynchronously
        val snapshot = connections.toList()
        broadcastExecutor.execute {
            snapshot.forEach { conn ->
                runCatching { conn.send(eventJson) }
            }
        }
    }

    fun sendToUser(userId: Int, event: WsEvent) {
        val conn = userConnections[userId] ?: return
        runCatching { conn.send(serializeEvent(event)) }
    }

    fun serializeEvent(event: WsEvent): String {
        val payload = when (event) {
            is WsEvent.History -> mapOf(
                "type" to "history",
                "messages" to event.messages.map { objectMapper.valueToTree<JsonNode>(it) },
                "hasMore" to event.hasMore
            )
            is WsEvent.Users -> mapOf(
                "type" to "users",
                "users" to event.users
            )
            is WsEvent.Message -> mapOf(
                "type" to "message",
                "message" to objectMapper.valueToTree<JsonNode>(event.message)
            )
            is WsEvent.UserJoined -> mapOf(
                "type" to "user_joined",
                "user" to event.user
            )
            is WsEvent.UserLeft -> mapOf(
                "type" to "user_left",
                "userId" to event.userId,
                "username" to event.username
            )
            is WsEvent.Error -> mapOf(
                "type" to "error",
                "message" to event.message
            )
            is WsEvent.MessageEdited -> mapOf(
                "type" to "message_edited",
                "messageId" to event.messageId,
                "content" to event.content,
                "editedAt" to event.editedAt
            )
            is WsEvent.MessageDeleted -> mapOf(
                "type" to "message_deleted",
                "messageId" to event.messageId
            )
            is WsEvent.PrivateMessageEvent -> mapOf(
                "type" to "private_message",
                "message" to objectMapper.valueToTree<JsonNode>(event.message)
            )
            is WsEvent.PrivateHistory -> mapOf(
                "type" to "private_history",
                "messages" to event.messages.map { objectMapper.valueToTree<JsonNode>(it) },
                "hasMore" to event.hasMore
            )
            is WsEvent.Mention -> mapOf(
                "type" to "mention",
                "messageId" to event.messageId,
                "mentionedBy" to event.mentionedBy,
                "content" to event.content
            )
            is WsEvent.UserUpdated -> mapOf(
                "type" to "user_updated",
                "user" to event.user
            )
            is WsEvent.Kicked -> mapOf(
                "type" to "kicked",
                "reason" to event.reason
            )
            is WsEvent.RoleChanged -> mapOf(
                "type" to "role_changed",
                "userId" to event.userId,
                "role" to event.role
            )
            is WsEvent.SearchResults -> mapOf(
                "type" to "search_results",
                "messages" to event.messages.map { objectMapper.valueToTree<JsonNode>(it) },
                "query" to event.query
            )
            is WsEvent.UnreadCounts -> mapOf(
                "type" to "unread_counts",
                "unreadDms" to event.unreadDms
            )
            is WsEvent.Typing -> mapOf(
                "type" to "typing",
                "userId" to event.userId,
                "username" to event.username,
                "isTyping" to event.isTyping
            )
        }
        return objectMapper.writeValueAsString(payload)
    }
}
