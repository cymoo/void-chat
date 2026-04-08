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
        val ctx = DatabaseConfig.createDSLContext(ds)
        // Disable FK checks so system messages (user_id=0) don't fail
        ctx.execute("PRAGMA foreign_keys = OFF")
        ctx
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
}
