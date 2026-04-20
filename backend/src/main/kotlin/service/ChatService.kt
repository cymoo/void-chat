package service

import com.fasterxml.jackson.databind.ObjectMapper
import io.github.cymoo.colleen.ws.WsConnection
import model.*
import org.jooq.DSLContext
import org.slf4j.LoggerFactory
import redis.clients.jedis.JedisPool
import redis.clients.jedis.JedisPubSub
import repository.MessageRepository
import repository.PrivateMessageRepository
import repository.RoomMemberRepository
import repository.RoomRepository
import repository.UserRepository
import persona.PersonaChatEngine
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Chat service managing rooms, connections, and message broadcasting.
 * Optionally uses Redis pub/sub for multi-instance broadcast readiness.
 */
class ChatService(
    dsl: DSLContext,
    private val objectMapper: ObjectMapper,
    private val jedisPool: JedisPool? = null
) {
    private val log = LoggerFactory.getLogger(ChatService::class.java)
    private val instanceId = UUID.randomUUID().toString()

    private val messageRepo = MessageRepository(dsl)
    private val userRepo = UserRepository(dsl)
    private val roomMemberRepo = RoomMemberRepository(dsl, userRepo)
    private val roomRepo = RoomRepository(dsl)
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

    /** Optional persona engine — injected after construction to break circular dependency. */
    var personaChatEngine: PersonaChatEngine? = null

    /**
     * Register a user's WebSocket connection into a chat room.
     * Handles room capacity enforcement, connection counting (for multi-tab),
     * and first-occupant broadcasts (system message, user list update).
     *
     * @return true if the connection was added; false if room is full.
     */
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
                val room = roomRepo.findById(roomId)
                val maxUsers = room?.maxUsers ?: Int.MAX_VALUE

                if (isNewOccupant && userCounts.size >= maxUsers) {
                    return@synchronized JoinResult(joined = false)
                }

                val connections = roomConnections.computeIfAbsent(roomId) { CopyOnWriteArraySet() }
                connections.add(connection)
                userConnections[user.id] = connection

                val activeCount = userCounts.merge(user.id, 1) { prev, _ -> prev + 1 } ?: 1

                // Only the first active connection triggers the join broadcast.
                if (activeCount != 1) return@synchronized JoinResult(joined = true)

                val isRoomOwner = room?.creatorId == user.id
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

    /** Register a user's direct-message WebSocket connection. */
    fun attachDirectConnection(userId: Int, connection: WsConnection) {
        userConnections[userId] = connection
    }

    fun detachDirectConnection(userId: Int, connection: WsConnection) {
        if (userConnections[userId] == connection) {
            userConnections.remove(userId)
        }
    }

    /**
     * Remove a WebSocket connection from a room. If this was the user's last
     * connection in the room, broadcasts a leave system message.
     */
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

    /** Send a text message to a room. Returns false if user is muted/disabled. */
    fun sendTextMessage(roomId: Int, user: User, content: String, replyToId: Int? = null): Boolean {
        if (roomMessageBlockReason(user.id) != null) return false
        return doSendTextMessage(roomId, user, content, replyToId)
    }

    /** Send a bot text message bypassing mute/disable checks. */
    fun sendBotTextMessage(roomId: Int, user: User, content: String, replyToId: Int? = null): Boolean {
        return doSendTextMessage(roomId, user, content, replyToId)
    }

    private fun doSendTextMessage(roomId: Int, user: User, content: String, replyToId: Int? = null): Boolean {
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

        // Persona hook: notify engine of new message (async)
        personaChatEngine?.onRoomMessage(roomId, user.id, user.username, content, messageId, replyToId)

        return true
    }

    fun sendImageMessage(roomId: Int, user: User, imageUrl: String, thumbnailUrl: String?, width: Int? = null, height: Int? = null, replyToId: Int? = null): Boolean {
        if (roomMessageBlockReason(user.id) != null) return false
        val messageId = messageRepo.saveImageMessage(roomId, user.id, imageUrl, thumbnailUrl, width, height, replyToId)

        val replyInfo = if (replyToId != null) getReplyInfoById(replyToId) else null

        val message = ChatMessage.Image(
            id = messageId,
            userId = user.id,
            username = user.username,
            avatarUrl = user.avatarUrl,
            imageUrl = imageUrl,
            thumbnailUrl = thumbnailUrl,
            width = width,
            height = height,
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

    fun getRecentMessages(roomId: Int, limit: Int): List<ChatMessage> {
        return messageRepo.getRecentMessages(roomId, limit)
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
        val users = roomMemberRepo.getRoomMembers(roomId)
        return personaChatEngine?.enrichUsers(users, roomId) ?: users
    }

    /** Returns the number of online users per room based on active WebSocket connections. */
    fun getOnlineUserCounts(): Map<Int, Int> {
        return roomUserConnectionCounts.mapValues { (_, userCounts) -> userCounts.size }
    }

    /** Exposed for testing: returns the broadcast executor so tests can await pending tasks. */
    internal fun broadcastExecutorForTest(): ExecutorService = broadcastExecutor

    /**
     * Send a private message between two users.
     * Both sender and receiver get the event for real-time sync.
     */
    fun sendPrivateMessage(
        sender: User,
        receiverId: Int,
        messageType: String,
        content: String? = null,
        fileUrl: String? = null,
        fileName: String? = null,
        fileSize: Long? = null,
        mimeType: String? = null,
        thumbnailUrl: String? = null,
        width: Int? = null,
        height: Int? = null
    ) {
        val messageId = when (messageType) {
            "text" -> privateMessageRepo.saveTextMessage(sender.id, receiverId, content ?: "")
            "image" -> privateMessageRepo.saveImageMessage(sender.id, receiverId, fileUrl ?: "", thumbnailUrl, width, height)
            "file" -> privateMessageRepo.saveFileMessage(
                sender.id, receiverId, fileName ?: "", fileUrl ?: "", fileSize ?: 0L, mimeType ?: ""
            )
            else -> throw IllegalArgumentException("Unsupported DM type: $messageType")
        }
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
            width = width,
            height = height,
            timestamp = System.currentTimeMillis()
        )

        // Send to receiver
        sendToUser(receiverId, WsEvent.PrivateMessageEvent(pm))

        // Send to sender (confirmation)
        sendToUser(sender.id, WsEvent.PrivateMessageEvent(pm))
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

    /**
     * Checks whether the user is allowed to send room messages.
     * @return a human-readable reason string if blocked, or null if allowed.
     */
    fun roomMessageBlockReason(userId: Int): String? {
        val latestUser = userRepo.findById(userId) ?: return "User not found"
        if (latestUser.isDisabled) return "Account is disabled"
        if (latestUser.isMuted) return "You are muted and cannot send room messages"
        return null
    }

    /** Assign a room-level role (admin/moderator/member) to a user. */
    fun setUserRole(roomId: Int, actorUser: User, targetUserId: Int, role: String): Boolean {
        val actorRoomRole = roomMemberRepo.getMemberRole(roomId, actorUser.id)
        if (!authorizationService.canManageRoomRoles(actorUser, actorRoomRole)) return false

        val desiredRole = role.trim().lowercase()
        if (!AuthorizationService.isValidAssignableRoomRole(desiredRole)) return false

        val targetCurrentRole = roomMemberRepo.getMemberRole(roomId, targetUserId) ?: return false
        if (AuthorizationService.normalizeRoomRole(targetCurrentRole) == AuthorizationService.ROOM_ROLE_OWNER &&
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
        if (AuthorizationService.normalizeRoomRole(targetRole) == AuthorizationService.ROOM_ROLE_OWNER &&
            !authorizationService.isPlatformAdmin(actorUser)
        ) {
            return false
        }

        roomMemberRepo.removeMember(roomId, targetUserId)

        // Persona hook: clean up room bot tracking
        personaChatEngine?.onUserKicked(roomId, targetUserId)

        sendToUser(targetUserId, WsEvent.Kicked(reason))
        // Close local connection if present (WsConnection is JVM-local)
        val targetConn = userConnections[targetUserId]
        if (targetConn != null) {
            runCatching { targetConn.close() }
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
        val mentionPattern = Regex("@([\\p{L}\\p{N}_]+)")
        val mentions = mentionPattern.findAll(content).map { it.groupValues[1] }.toList()

        if (mentions.isEmpty()) return

        val roomUsers = getRoomUsers(roomId)
        mentions.forEach { name ->
            val mentionedUser = roomUsers.find {
                it.username.equals(name, ignoreCase = true) ||
                    (it.displayName != null && it.displayName.equals(name, ignoreCase = true))
            }
            if (mentionedUser != null) {
                sendToUser(mentionedUser.id, WsEvent.Mention(messageId, mentionedBy, content))
            }
        }
    }

    private fun getReplyInfoById(messageId: Int): ReplyInfo? {
        return messageRepo.getReplyInfo(messageId)
    }

    /** Broadcast a [WsEvent] to all connections in a room (local + Redis pub/sub). */
    fun broadcastToRoom(roomId: Int, event: WsEvent) {
        val eventJson = serializeEvent(event)
        deliverToLocalRoom(roomId, eventJson)
        publishToRedis("room:$roomId", eventJson)
    }

    /** Send a [WsEvent] to a specific user (local + Redis pub/sub). */
    fun sendToUser(userId: Int, event: WsEvent) {
        val eventJson = serializeEvent(event)
        deliverToLocalUser(userId, eventJson)
        publishToRedis("user:$userId", eventJson)
    }

    /** Deliver to WebSocket connections on this JVM instance. */
    private fun deliverToLocalRoom(roomId: Int, eventJson: String) {
        val connections = roomConnections[roomId] ?: return
        val snapshot = connections.toList()
        broadcastExecutor.execute {
            snapshot.forEach { conn -> runCatching { conn.send(eventJson) } }
        }
    }

    private fun deliverToLocalUser(userId: Int, eventJson: String) {
        val conn = userConnections[userId] ?: return
        runCatching { conn.send(eventJson) }
    }

    private fun publishToRedis(channel: String, message: String) {
        if (jedisPool == null) return
        try {
            jedisPool.resource.use { jedis ->
                jedis.publish(channel, "$instanceId|$message")
            }
        } catch (e: Exception) {
            log.warn("Redis publish to {} failed: {}", channel, e.message)
        }
    }

    /**
     * Start the Redis subscriber thread for cross-instance message delivery.
     * Call once after construction (in Main.kt). No-op if jedisPool is null.
     */
    fun startRedisSubscriber() {
        if (jedisPool == null) return
        Thread({
            while (!Thread.currentThread().isInterrupted) {
                try {
                    jedisPool.resource.use { jedis ->
                        jedis.psubscribe(object : JedisPubSub() {
                            override fun onPMessage(pattern: String, channel: String, message: String) {
                                val sep = message.indexOf('|')
                                if (sep < 0) return
                                val senderId = message.substring(0, sep)
                                if (senderId == instanceId) return
                                val eventJson = message.substring(sep + 1)

                                when {
                                    channel.startsWith("room:") -> {
                                        val roomId = channel.removePrefix("room:").toIntOrNull() ?: return
                                        deliverToLocalRoom(roomId, eventJson)
                                    }
                                    channel.startsWith("user:") -> {
                                        val userId = channel.removePrefix("user:").toIntOrNull() ?: return
                                        deliverToLocalUser(userId, eventJson)
                                    }
                                }
                            }
                        }, "room:*", "user:*")
                    }
                } catch (e: Exception) {
                    log.warn("Redis subscriber disconnected, reconnecting in 3s: {}", e.message)
                    Thread.sleep(3000)
                }
            }
        }, "redis-subscriber").apply { isDaemon = true }.start()
        log.info("Redis pub/sub subscriber started (instance={})", instanceId.take(8))
    }

    /** Serialize a [WsEvent] to JSON via Jackson type annotations. */
    fun serializeEvent(event: WsEvent): String = objectMapper.writeValueAsString(event)
}
