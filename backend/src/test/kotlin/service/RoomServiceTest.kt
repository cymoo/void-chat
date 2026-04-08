package service

import config.DatabaseConfig
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.jooq.DSLContext
import repository.UserRepository

class RoomServiceTest {

    private lateinit var roomService: RoomService
    private lateinit var dsl: DSLContext
    private var ownerId = 0
    private var otherId = 0

    @BeforeEach
    fun setUp() {
        val ds = DatabaseConfig.createDataSource("jdbc:sqlite::memory:")
        DatabaseConfig.runMigrations(ds)
        dsl = DatabaseConfig.createDSLContext(ds)
        roomService = RoomService(dsl)

        val userRepo = UserRepository(dsl)
        ownerId = userRepo.createUser("owner", "hash").id
        otherId = userRepo.createUser("other", "hash").id
    }

    @Test
    fun `getAllRooms returns default rooms`() {
        val rooms = roomService.getAllRooms()
        assertTrue(rooms.size >= 3, "Should have at least 3 default rooms")
        val names = rooms.map { it.name }
        assertTrue(names.contains("general"))
        assertTrue(names.contains("random"))
        assertTrue(names.contains("tech"))
    }

    @Test
    fun `createRoom creates and returns new room`() {
        val room = roomService.createRoom("test-room", "A test room", creatorId = ownerId)
        assertEquals("test-room", room.name)
        assertEquals("A test room", room.description)
        assertFalse(room.isPrivate)
    }

    @Test
    fun `createRoom with blank name throws`() {
        assertThrows<IllegalArgumentException> {
            roomService.createRoom("", "desc")
        }
    }

    @Test
    fun `createRoom private without password throws`() {
        assertThrows<IllegalArgumentException> {
            roomService.createRoom("private-room", "desc", isPrivate = true)
        }
    }

    @Test
    fun `createRoom private with password succeeds`() {
        val room = roomService.createRoom("private-room", "desc", isPrivate = true, password = "secret123", creatorId = ownerId)
        assertTrue(room.isPrivate)
    }

    @Test
    fun `getRoomById returns room`() {
        val room = roomService.createRoom("findme", "desc", creatorId = ownerId)
        val found = roomService.getRoomById(room.id)
        assertNotNull(found)
        assertEquals("findme", found!!.name)
    }

    @Test
    fun `getRoomById returns null for nonexistent`() {
        assertNull(roomService.getRoomById(9999))
    }

    @Test
    fun `getRoomByName returns room`() {
        roomService.createRoom("byname", "desc", creatorId = ownerId)
        val found = roomService.getRoomByName("byname")
        assertNotNull(found)
        assertEquals("byname", found!!.name)
    }

    @Test
    fun `verifyRoomPassword returns true for public room`() {
        val room = roomService.createRoom("pub", "desc", creatorId = ownerId)
        assertTrue(roomService.verifyRoomPassword(room.id, null))
    }

    @Test
    fun `verifyRoomPassword validates correct password`() {
        val room = roomService.createRoom("priv", "desc", isPrivate = true, password = "secret", creatorId = ownerId)
        assertTrue(roomService.verifyRoomPassword(room.id, "secret"))
        assertFalse(roomService.verifyRoomPassword(room.id, "wrong"))
        assertFalse(roomService.verifyRoomPassword(room.id, null))
    }

    @Test
    fun `deleteRoom succeeds for owner`() {
        val room = roomService.createRoom("deleteme", "desc", creatorId = ownerId)
        assertTrue(roomService.deleteRoom(room.id, ownerId))
        assertNull(roomService.getRoomById(room.id))
    }

    @Test
    fun `deleteRoom fails for non-owner`() {
        val room = roomService.createRoom("protected", "desc", creatorId = ownerId)
        assertFalse(roomService.deleteRoom(room.id, otherId))
        assertNotNull(roomService.getRoomById(room.id))
    }
}
