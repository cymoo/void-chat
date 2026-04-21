package service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.github.cymoo.colleen.ws.WsConnection
import io.mockk.*
import model.ChatMessage
import model.User
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import repository.RoomRepository
import repository.UserRepository

class ChatServiceTest {

    private val objectMapper = jacksonObjectMapper()
    private val dsl = TestDatabase.createDsl()
    private val chatService = ChatService(dsl, objectMapper)
    private val userRepo = UserRepository(dsl)
    private val roomRepo = RoomRepository(dsl)

    // Room IDs created during setup
    private var room1Id = 0
    private var room2Id = 0
    private var room3Id = 0

    private fun createUser(username: String): User {
        return userRepo.createUser(username, "hash")
    }

    private fun mockConnection(): WsConnection {
        val conn = mockk<WsConnection>(relaxed = true)
        every { conn.send(any<String>()) } just Runs
        return conn
    }

    /** Allow time for async broadcasts to be delivered. */
    private fun awaitBroadcasts() {
        // Submit a no-op task and wait for it, ensuring prior broadcasts have been processed.
        java.util.concurrent.CompletableFuture.runAsync({}, chatService.broadcastExecutorForTest())
            .get(2, java.util.concurrent.TimeUnit.SECONDS)
    }
    private fun capturedMessages(conn: WsConnection): List<Map<*, *>> {
        val slot = mutableListOf<String>()
        verify { conn.send(capture(slot)) }
        return slot.map { objectMapper.readValue(it, Map::class.java) }
    }

    @BeforeEach
    fun setUp() {
        clearAllMocks()
        // The migration creates default rooms (general, random, tech) with ids 1, 2, 3
        room1Id = roomRepo.findByName("general")!!.id
        room2Id = roomRepo.findByName("random")!!.id
        room3Id = roomRepo.findByName("tech")!!.id
    }

    @AfterEach
    fun tearDown() {
        clearAllMocks()
    }

    // ---------------------------------------------------------------
    // Bug 1: user list should be broadcast to all after join / leave
    // ---------------------------------------------------------------

    @Test
    fun `joinRoom broadcasts Users list to all connections`() {
        val userA = createUser("alice")
        val userB = createUser("bob")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room1Id, connA, userA)
        // Allow async broadcasts to complete
        awaitBroadcasts()

        chatService.joinRoom(room1Id, connB, userB)
        awaitBroadcasts()

        // User A should have received a Users event containing both users
        val msgsA = capturedMessages(connA)
        val usersEvents = msgsA.filter { it["type"] == "users" }
        assertTrue(usersEvents.isNotEmpty(), "User A should receive at least one 'users' event after B joins")

        // The last 'users' event should contain both alice and bob
        @Suppress("UNCHECKED_CAST")
        val lastUsersList = (usersEvents.last()["users"] as List<Map<String, Any>>).map { it["username"] }
        assertTrue(lastUsersList.contains("alice"), "Users list should contain alice")
        assertTrue(lastUsersList.contains("bob"), "Users list should contain bob")
    }

    @Test
    fun `leaveRoom broadcasts updated Users list with offline member`() {
        val userA = createUser("charlie")
        val userB = createUser("dave")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room2Id, connA, userA)
        chatService.joinRoom(room2Id, connB, userB)
        awaitBroadcasts()
        // Clear recorded calls but keep mock behavior
        clearMocks(connA, connB, answers = false)

        chatService.leaveRoom(room2Id, userB, connB)
        awaitBroadcasts()

        // User A should receive a Users event; dave is still a member but offline
        val msgsA = capturedMessages(connA)
        val usersEvents = msgsA.filter { it["type"] == "users" }
        assertTrue(usersEvents.isNotEmpty(), "User A should receive a 'users' event after B leaves")

        @Suppress("UNCHECKED_CAST")
        val lastUsersList = usersEvents.last()["users"] as List<Map<String, Any>>
        assertTrue(lastUsersList.any { it["username"] == "charlie" }, "Users list should contain charlie")
        // dave is still a persistent member — now offline, not removed
        val daveEntry = lastUsersList.find { it["username"] == "dave" }
        assertNotNull(daveEntry, "dave should still appear in users list as offline member")
        assertFalse(daveEntry!!["isOnline"] as Boolean, "dave should be offline")
    }

    // ---------------------------------------------------------------
    // Bug 2: online count should reflect active connections only
    // ---------------------------------------------------------------

    @Test
    fun `getOnlineUserCounts returns zero for rooms with no connections`() {
        val counts = chatService.getOnlineUserCounts()
        assertEquals(0, counts.getOrDefault(room1Id, 0))
    }

    @Test
    fun `getOnlineUserCounts reflects active connections`() {
        val userA = createUser("eve")
        val userB = createUser("frank")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room1Id, connA, userA)
        chatService.joinRoom(room1Id, connB, userB)

        assertEquals(2, chatService.getOnlineUserCounts()[room1Id])
    }

    @Test
    fun `getOnlineUserCounts decreases after leave`() {
        val userA = createUser("grace")
        val userB = createUser("heidi")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room1Id, connA, userA)
        chatService.joinRoom(room1Id, connB, userB)
        chatService.leaveRoom(room1Id, userB, connB)

        assertEquals(1, chatService.getOnlineUserCounts()[room1Id])
    }

    @Test
    fun `joinRoom rejects user when room is at capacity`() {
        val limitedRoom = roomRepo.create(
            name = "limited-room",
            description = "one seat only",
            maxUsers = 1
        )
        val userA = createUser("limit-a")
        val userB = createUser("limit-b")
        val connA = mockConnection()
        val connB = mockConnection()

        val firstJoin = chatService.joinRoom(limitedRoom.id, connA, userA)
        val secondJoin = chatService.joinRoom(limitedRoom.id, connB, userB)

        assertTrue(firstJoin)
        assertFalse(secondJoin)
        assertEquals(1, chatService.getOnlineUserCounts()[limitedRoom.id])
        assertEquals(listOf("limit-a"), chatService.getRoomUsers(limitedRoom.id).map { it.username })
    }

    @Test
    fun `online count drops to zero when all users leave`() {
        val userA = createUser("ivan")
        val userB = createUser("judy")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room1Id, connA, userA)
        chatService.joinRoom(room1Id, connB, userB)
        chatService.leaveRoom(room1Id, userA, connA)
        chatService.leaveRoom(room1Id, userB, connB)

        assertEquals(0, chatService.getOnlineUserCounts().getOrDefault(room1Id, 0))
    }

    @Test
    fun `visiting multiple rooms then leaving keeps counts correct`() {
        val userA = createUser("karl")
        val userB = createUser("lisa")
        val connA1 = mockConnection()
        val connA2 = mockConnection()
        val connA3 = mockConnection()
        val connB1 = mockConnection()
        val connB2 = mockConnection()
        val connB3 = mockConnection()

        // Both users visit all three rooms then leave
        chatService.joinRoom(room1Id, connA1, userA)
        chatService.leaveRoom(room1Id, userA, connA1)
        chatService.joinRoom(room2Id, connA2, userA)
        chatService.leaveRoom(room2Id, userA, connA2)
        chatService.joinRoom(room3Id, connA3, userA)
        chatService.leaveRoom(room3Id, userA, connA3)

        chatService.joinRoom(room1Id, connB1, userB)
        chatService.leaveRoom(room1Id, userB, connB1)
        chatService.joinRoom(room2Id, connB2, userB)
        chatService.leaveRoom(room2Id, userB, connB2)
        chatService.joinRoom(room3Id, connB3, userB)
        chatService.leaveRoom(room3Id, userB, connB3)

        // All rooms should have 0 online users
        val counts = chatService.getOnlineUserCounts()
        assertEquals(0, counts.getOrDefault(room1Id, 0), "Room 1 should have 0 online")
        assertEquals(0, counts.getOrDefault(room2Id, 0), "Room 2 should have 0 online")
        assertEquals(0, counts.getOrDefault(room3Id, 0), "Room 3 should have 0 online")
    }

    // ---------------------------------------------------------------
    // Regression: React Strict-Mode double-mount (rapid reconnect)
    // ---------------------------------------------------------------

    // ---------------------------------------------------------------
    // Regression: React Strict-Mode double-mount (rapid reconnect)
    // ---------------------------------------------------------------

    /**
     * The React Strict-Mode pattern produces TWO overlapping connections:
     *   conn1 opens → conn2 opens → conn1 closes (in that order)
     * Only one UserJoined broadcast should fire, and no system messages at all.
     */
    @Test
    fun `overlapping reconnect join-join-leave produces single join broadcast`() {
        val userA = createUser("reconnect-user")
        val observer = createUser("observer")
        val connA1 = mockConnection()
        val connA2 = mockConnection()
        val connObs = mockConnection()

        // Observer is already in the room.
        chatService.joinRoom(room1Id, connObs, observer)
        awaitBroadcasts()
        clearMocks(connObs, answers = false)

        // Simulate overlap: conn2 opens before conn1 closes.
        chatService.joinRoom(room1Id, connA1, userA)  // count 0→1, broadcast UserJoined
        chatService.joinRoom(room1Id, connA2, userA)  // count 1→2, no broadcast
        chatService.leaveRoom(room1Id, userA, connA1) // count 2→1, no broadcast
        awaitBroadcasts()

        val msgs = capturedMessages(connObs)

        // No system messages should be emitted in the new presence model
        val systemMessages = msgs
            .filter { it["type"] == "message" }
            .mapNotNull {
                @Suppress("UNCHECKED_CAST")
                (it["message"] as? Map<String, Any>)
                    ?.takeIf { m -> m["messageType"] == "system" }
            }
        assertEquals(0, systemMessages.size, "No system messages expected in presence model")

        // Exactly one user_joined broadcast for the initial connection
        val userJoinedEvents = msgs.filter { it["type"] == "user_joined" }
        assertEquals(1, userJoinedEvents.size, "Expected exactly 1 user_joined event")

        // User must be visible in the room at the end (conn2 is still active).
        val roomUsers = chatService.getRoomUsers(room1Id)
        assertTrue(roomUsers.any { it.id == userA.id }, "User should be in room after overlapping reconnect")
    }

    /**
     * Sequential reconnect (fully disconnects then reconnects) emits
     * UserJoined twice and UserLeft once — no system messages.
     */
    @Test
    fun `sequential reconnect join-leave-join produces two join broadcasts`() {
        val userA = createUser("seq-reconnect-user")
        val observer = createUser("seq-observer")
        val connA1 = mockConnection()
        val connA2 = mockConnection()
        val connObs = mockConnection()

        chatService.joinRoom(room1Id, connObs, observer)
        awaitBroadcasts()
        clearMocks(connObs, answers = false)

        chatService.joinRoom(room1Id, connA1, userA)   // count 0→1, UserJoined
        chatService.leaveRoom(room1Id, userA, connA1)  // count 1→0, UserLeft
        chatService.joinRoom(room1Id, connA2, userA)   // count 0→1, UserJoined
        awaitBroadcasts()

        val msgs = capturedMessages(connObs)

        // No system messages
        val systemMessages = msgs
            .filter { it["type"] == "message" }
            .mapNotNull {
                @Suppress("UNCHECKED_CAST")
                (it["message"] as? Map<String, Any>)
                    ?.takeIf { m -> m["messageType"] == "system" }
            }
        assertEquals(0, systemMessages.size, "No system messages expected in presence model")

        assertEquals(2, msgs.count { it["type"] == "user_joined" }, "Sequential: 2 user_joined events")
        assertEquals(1, msgs.count { it["type"] == "user_left" }, "Sequential: 1 user_left event")
        assertTrue(
            chatService.getRoomUsers(room1Id).any { it.id == userA.id },
            "User should be in room after final join"
        )
    }

    /**
     * After many concurrent join→leave pairs for the same user finish, the user
     * must not be online but remains in the DB as a persistent member.
     */
    @Test
    fun `concurrent join and leave are serialised correctly`() {
        val user = createUser("concurrent")
        val executor = java.util.concurrent.Executors.newFixedThreadPool(4)
        val latch = java.util.concurrent.CountDownLatch(20)

        repeat(20) {
            val conn = mockConnection()
            executor.submit {
                // In real usage, leaveRoom is always called AFTER joinRoom for
                // the same connection. Each thread respects that ordering; the
                // concurrency is between different threads (connections).
                chatService.joinRoom(room3Id, conn, user)
                chatService.leaveRoom(room3Id, user, conn)
                latch.countDown()
            }
        }

        latch.await(10, java.util.concurrent.TimeUnit.SECONDS)
        executor.shutdown()
        awaitBroadcasts()

        // All connections have left: online count must be 0.
        // User remains in DB as a persistent member (not removed on WS disconnect).
        val onlineCount = chatService.getOnlineUserCounts().getOrDefault(room3Id, 0)
        val dbMembers = chatService.getRoomUsers(room3Id)
        val userInDb = dbMembers.any { it.id == user.id }

        assertEquals(0, onlineCount, "Online count should be 0 after all leaves")
        assertTrue(userInDb, "User should remain as persistent member after WS disconnects")
    }

    // ---------------------------------------------------------------
    // leaveRoomExplicit (persistent leave)
    // ---------------------------------------------------------------

    @Test
    fun `leaveRoomExplicit removes member from DB and closes connections`() {
        val userA = createUser("explicit-alice")
        val userB = createUser("explicit-bob")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room1Id, connA, userA)
        chatService.joinRoom(room1Id, connB, userB)
        awaitBroadcasts()
        clearMocks(connA, connB, answers = false)

        chatService.leaveRoomExplicit(room1Id, userB)
        awaitBroadcasts()

        // bob should be fully removed from DB
        val members = chatService.getRoomUsers(room1Id)
        assertFalse(members.any { it.id == userB.id }, "bob should be removed from room members")
        // online count should drop to 1
        assertEquals(1, chatService.getOnlineUserCounts().getOrDefault(room1Id, 0))
        // user_left broadcast should reach alice
        val msgsA = capturedMessages(connA)
        assertTrue(msgsA.any { it["type"] == "user_left" }, "alice should receive user_left event")
        assertTrue(msgsA.any { it["type"] == "users" }, "alice should receive updated users list")
    }

    @Test
    fun `leaveRoomExplicit does not remove other members`() {
        val userA = createUser("explicit2-alice")
        val userB = createUser("explicit2-bob")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room2Id, connA, userA)
        chatService.joinRoom(room2Id, connB, userB)
        awaitBroadcasts()

        chatService.leaveRoomExplicit(room2Id, userB)
        awaitBroadcasts()

        val members = chatService.getRoomUsers(room2Id)
        assertTrue(members.any { it.id == userA.id }, "alice should remain in room")
        assertFalse(members.any { it.id == userB.id }, "bob should be removed")
    }

    // ---------------------------------------------------------------
    // Image message broadcast
    // ---------------------------------------------------------------

    @Test
    fun `sendImageMessage broadcasts image message to all room members`() {
        val userA = createUser("img-alice")
        val userB = createUser("img-bob")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room1Id, connA, userA)
        chatService.joinRoom(room1Id, connB, userB)
        awaitBroadcasts()
        clearMocks(connA, connB, answers = false)

        chatService.sendImageMessage(room1Id, userA, "https://example.com/img.png", null)
        awaitBroadcasts()

        listOf(connA, connB).forEach { conn ->
            val msgs = capturedMessages(conn)
            val msgEvents = msgs.filter { it["type"] == "message" }
            assertTrue(msgEvents.isNotEmpty(), "Both users should receive a 'message' event")
            @Suppress("UNCHECKED_CAST")
            val inner = msgEvents.first()["message"] as Map<String, Any>
            assertEquals("image", inner["messageType"])
            assertEquals("https://example.com/img.png", inner["imageUrl"])
        }
    }

    // ---------------------------------------------------------------
    // Text message with reply
    // ---------------------------------------------------------------

    @Test
    fun `sendTextMessage with replyToId includes reply info in broadcast`() {
        val user = createUser("reply-user")
        val conn = mockConnection()

        chatService.joinRoom(room2Id, conn, user)
        awaitBroadcasts()

        chatService.sendTextMessage(room2Id, user, "original message")
        awaitBroadcasts()
        val firstMessageId = chatService.getMessageHistory(room2Id)
            .filterIsInstance<ChatMessage.Text>()
            .last { it.content == "original message" }.id

        clearMocks(conn, answers = false)

        chatService.sendTextMessage(room2Id, user, "reply message", replyToId = firstMessageId)
        awaitBroadcasts()

        val msgs = capturedMessages(conn)
        val msgEvents = msgs.filter { it["type"] == "message" }
        assertTrue(msgEvents.isNotEmpty(), "Should receive a 'message' event for the reply")
        @Suppress("UNCHECKED_CAST")
        val inner = msgEvents.first()["message"] as Map<String, Any>
        assertNotNull(inner["replyTo"], "Reply message should include replyTo info")
        @Suppress("UNCHECKED_CAST")
        val replyTo = inner["replyTo"] as Map<String, Any>
        assertEquals(firstMessageId, replyTo["id"])
    }

    // ---------------------------------------------------------------
    // Message edit
    // ---------------------------------------------------------------

    @Test
    fun `editMessage broadcasts message_edited event to room`() {
        val userA = createUser("edit-alice")
        val userB = createUser("edit-bob")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room3Id, connA, userA)
        chatService.joinRoom(room3Id, connB, userB)
        awaitBroadcasts()
        chatService.sendTextMessage(room3Id, userA, "original content")
        awaitBroadcasts()
        val messageId = chatService.getMessageHistory(room3Id)
            .filterIsInstance<ChatMessage.Text>()
            .last { it.content == "original content" }.id

        clearMocks(connA, connB, answers = false)

        chatService.editMessage(room3Id, userA, messageId, "edited content")
        awaitBroadcasts()

        listOf(connA, connB).forEach { conn ->
            val msgs = capturedMessages(conn)
            val editEvents = msgs.filter { it["type"] == "message_edited" }
            assertTrue(editEvents.isNotEmpty(), "Both users should receive 'message_edited' event")
            assertEquals(messageId, editEvents.first()["messageId"])
            assertEquals("edited content", editEvents.first()["content"])
        }
    }

    // ---------------------------------------------------------------
    // Message delete
    // ---------------------------------------------------------------

    @Test
    fun `deleteMessage broadcasts message_deleted event to room`() {
        val userA = createUser("del-alice")
        val userB = createUser("del-bob")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room1Id, connA, userA)
        chatService.joinRoom(room1Id, connB, userB)
        awaitBroadcasts()
        chatService.sendTextMessage(room1Id, userA, "to-be-deleted")
        awaitBroadcasts()
        val messageId = chatService.getMessageHistory(room1Id)
            .filterIsInstance<ChatMessage.Text>()
            .last { it.content == "to-be-deleted" }.id

        clearMocks(connA, connB, answers = false)

        chatService.deleteMessage(room1Id, userA, messageId)
        awaitBroadcasts()

        listOf(connA, connB).forEach { conn ->
            val msgs = capturedMessages(conn)
            val deleteEvents = msgs.filter { it["type"] == "message_deleted" }
            assertTrue(deleteEvents.isNotEmpty(), "Both users should receive 'message_deleted' event")
            assertEquals(messageId, deleteEvents.first()["messageId"])
        }
    }

    // ---------------------------------------------------------------
    // Typing broadcast
    // ---------------------------------------------------------------

    @Test
    fun `sendTypingStatus broadcasts typing event to room members`() {
        val userA = createUser("typing-alice")
        val userB = createUser("typing-bob")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.joinRoom(room2Id, connA, userA)
        chatService.joinRoom(room2Id, connB, userB)
        awaitBroadcasts()
        clearMocks(connA, connB, answers = false)

        chatService.sendTypingStatus(room2Id, userA, true)
        awaitBroadcasts()

        val msgsB = capturedMessages(connB)
        val typingEvents = msgsB.filter { it["type"] == "typing" }
        assertTrue(typingEvents.isNotEmpty(), "User B should receive typing event")
        assertEquals(userA.id, typingEvents.first()["userId"])
        assertEquals(userA.username, typingEvents.first()["username"])
        assertEquals(true, typingEvents.first()["isTyping"])
    }

    // ---------------------------------------------------------------
    // Private message delivery
    // ---------------------------------------------------------------

    @Test
    fun `sendPrivateMessage delivers to both sender and recipient`() {
        val userA = createUser("pm-alice")
        val userB = createUser("pm-bob")
        val connA = mockConnection()
        val connB = mockConnection()

        chatService.attachDirectConnection(userA.id, connA)
        chatService.attachDirectConnection(userB.id, connB)

        chatService.sendPrivateMessage(
            sender = userA,
            receiverId = userB.id,
            messageType = "text",
            content = "private hello"
        )
        awaitBroadcasts()

        listOf(connA, connB).forEach { conn ->
            val msgs = capturedMessages(conn)
            val pmEvents = msgs.filter { it["type"] == "private_message" }
            assertTrue(pmEvents.isNotEmpty(), "Both sender and recipient should receive 'private_message' event")
            @Suppress("UNCHECKED_CAST")
            val pm = pmEvents.first()["message"] as Map<String, Any>
            assertEquals("private hello", pm["content"])
            assertEquals(userA.id, pm["senderId"])
            assertEquals(userB.id, pm["receiverId"])
        }
    }

    // ---------------------------------------------------------------
    // Paginated message history
    // ---------------------------------------------------------------

    @Test
    fun `getOlderMessages returns messages before the given id`() {
        val user = createUser("hist-user")
        val conn = mockConnection()
        val histRoom = roomRepo.create("hist-test-room", "for history pagination test")

        chatService.joinRoom(histRoom.id, conn, user)
        awaitBroadcasts()

        repeat(5) { i -> chatService.sendTextMessage(histRoom.id, user, "history-msg-$i") }
        awaitBroadcasts()

        val textMessages = chatService.getMessageHistory(histRoom.id)
            .filterIsInstance<ChatMessage.Text>()
            .filter { it.content.startsWith("history-msg-") }
        assertEquals(5, textMessages.size)

        val lastMsg = textMessages.last()
        val (older, _) = chatService.getOlderMessages(histRoom.id, lastMsg.id)

        assertTrue(older.isNotEmpty(), "Should return older messages")
        assertTrue(older.none { it.id == lastMsg.id }, "Boundary message must not appear in older results")
        assertTrue(older.all { it.id < lastMsg.id }, "All returned messages must have id < boundary")
    }

    @Test
    fun `getDmInbox returns only users with private history plus latest message and unread count`() {
        val currentUser = createUser("current-user")
        val alice = createUser("alice-dm")
        val bob = createUser("bob-dm")
        val noHistory = createUser("no-history")

        chatService.sendPrivateMessage(
            sender = alice,
            receiverId = currentUser.id,
            messageType = "text",
            content = "first from alice"
        )
        chatService.sendPrivateMessage(
            sender = currentUser,
            receiverId = bob.id,
            messageType = "text",
            content = "hello bob"
        )
        chatService.sendPrivateMessage(
            sender = alice,
            receiverId = currentUser.id,
            messageType = "text",
            content = "latest from alice"
        )

        val inbox = chatService.getDmInbox(currentUser.id)

        assertEquals(listOf(alice.id, bob.id), inbox.map { it.userId })
        assertEquals("alice-dm", inbox[0].username)
        assertEquals("latest from alice", inbox[0].latestMessagePreview)
        assertEquals("text", inbox[0].latestMessageType)
        assertEquals(alice.id, inbox[0].latestMessageSenderId)
        assertEquals(2, inbox[0].unreadCount)
        assertTrue(inbox[0].latestMessageTimestamp > 0)

        assertEquals("bob-dm", inbox[1].username)
        assertEquals("hello bob", inbox[1].latestMessagePreview)
        assertEquals(currentUser.id, inbox[1].latestMessageSenderId)
        assertEquals(0, inbox[1].unreadCount)
        assertFalse(inbox.any { it.userId == noHistory.id })
    }
}
