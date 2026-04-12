package service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import config.DatabaseConfig
import io.github.cymoo.colleen.ws.WsConnection
import io.mockk.*
import model.User
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import repository.RoomRepository
import repository.UserRepository

class ChatServiceTest {

    private val objectMapper = jacksonObjectMapper()
    private val dsl = run {
        val ds = DatabaseConfig.createDataSource("jdbc:sqlite::memory:")
        DatabaseConfig.runMigrations(ds)
        DatabaseConfig.createDSLContext(ds)
    }
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
    fun `leaveRoom broadcasts updated Users list`() {
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

        // User A should receive a Users event with only charlie
        val msgsA = capturedMessages(connA)
        val usersEvents = msgsA.filter { it["type"] == "users" }
        assertTrue(usersEvents.isNotEmpty(), "User A should receive a 'users' event after B leaves")

        @Suppress("UNCHECKED_CAST")
        val lastUsersList = (usersEvents.last()["users"] as List<Map<String, Any>>).map { it["username"] }
        assertTrue(lastUsersList.contains("charlie"), "Users list should contain charlie")
        assertFalse(lastUsersList.contains("dave"), "Users list should not contain dave")
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
     * Only one "joined" should broadcast, and no "left" should appear.
     *
     * This is distinct from a fully sequential reconnect (join→leave→join),
     * which correctly emits two "joined" and one "left".
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
        chatService.joinRoom(room1Id, connA1, userA)  // count 0→1, broadcast "joined"
        chatService.joinRoom(room1Id, connA2, userA)  // count 1→2, no broadcast
        chatService.leaveRoom(room1Id, userA, connA1) // count 2→1, no broadcast
        awaitBroadcasts()

        val msgs = capturedMessages(connObs)
        val systemMessages = msgs
            .filter { it["type"] == "message" }
            .mapNotNull {
                @Suppress("UNCHECKED_CAST")
                (it["message"] as? Map<String, Any>)
                    ?.takeIf { m -> m["messageType"] == "system" }
                    ?.get("content") as? String
            }

        val joinCount = systemMessages.count { it.contains("joined") }
        val leaveCount = systemMessages.count { it.contains("left") }

        assertEquals(1, joinCount, "Expected exactly 1 'joined' system message, got: $systemMessages")
        assertEquals(0, leaveCount, "Expected no 'left' system message, got: $systemMessages")

        // User must be visible in the room at the end (conn2 is still active).
        val roomUsers = chatService.getRoomUsers(room1Id)
        assertTrue(roomUsers.any { it.id == userA.id }, "User should be in room after overlapping reconnect")
    }

    /**
     * Sequential reconnect (fully disconnects then reconnects) correctly
     * emits "joined", "left", "joined" — the backend is not expected to suppress
     * these; the frontend fix prevents this sequence from occurring in practice.
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

        chatService.joinRoom(room1Id, connA1, userA)   // count 0→1, "joined"
        chatService.leaveRoom(room1Id, userA, connA1)  // count 1→0, "left"
        chatService.joinRoom(room1Id, connA2, userA)   // count 0→1, "joined"
        awaitBroadcasts()

        val msgs = capturedMessages(connObs)
        val systemMessages = msgs
            .filter { it["type"] == "message" }
            .mapNotNull {
                @Suppress("UNCHECKED_CAST")
                (it["message"] as? Map<String, Any>)
                    ?.takeIf { m -> m["messageType"] == "system" }
                    ?.get("content") as? String
            }

        assertEquals(2, systemMessages.count { it.contains("joined") }, "Sequential: 2 joined")
        assertEquals(1, systemMessages.count { it.contains("left") }, "Sequential: 1 left")
        assertTrue(
            chatService.getRoomUsers(room1Id).any { it.id == userA.id },
            "User should be in room after final join"
        )
    }

    /**
     * After many concurrent join→leave pairs for the same user finish, the user
     * must not be in the DB and the online count must be 0.
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

        // All connections have left: user must not appear in DB or online counts.
        val onlineCount = chatService.getOnlineUserCounts().getOrDefault(room3Id, 0)
        val dbMembers = chatService.getRoomUsers(room3Id)
        val userInDb = dbMembers.any { it.id == user.id }

        assertEquals(0, onlineCount, "Online count should be 0 after all leaves")
        assertFalse(userInDb, "User should not be in DB after all leaves")
    }
}
