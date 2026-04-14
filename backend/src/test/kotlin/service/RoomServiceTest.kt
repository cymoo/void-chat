package service

import model.User
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.jooq.DSLContext
import repository.UserRepository

class RoomServiceTest {

    private lateinit var roomService: RoomService
    private lateinit var dsl: DSLContext
    private lateinit var owner: User
    private lateinit var other: User

    @BeforeEach
    fun setUp() {
        dsl = TestDatabase.createDsl()
        roomService = RoomService(dsl)

        val userRepo = UserRepository(dsl)
        owner = userRepo.createUser("owner", "hash")
        other = userRepo.createUser("other", "hash")
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
        val room = roomService.createRoom("test-room", "A test room", creatorId = owner.id)
        assertEquals("test-room", room.name)
        assertEquals("A test room", room.description)
        assertFalse(room.isPrivate)
    }

    @Test
    fun `createRoom applies custom max users`() {
        val room = roomService.createRoom("capacity-room", "A room with limit", creatorId = owner.id, maxUsers = 42)
        assertEquals(42, room.maxUsers)
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
    fun `createRoom with invalid max users throws`() {
        assertThrows<IllegalArgumentException> {
            roomService.createRoom("invalid-capacity", "desc", creatorId = owner.id, maxUsers = 0)
        }
    }

    @Test
    fun `createRoom private with password succeeds`() {
        val room = roomService.createRoom("private-room", "desc", isPrivate = true, password = "secret123", creatorId = owner.id)
        assertTrue(room.isPrivate)
    }

    @Test
    fun `getRoomById returns room`() {
        val room = roomService.createRoom("findme", "desc", creatorId = owner.id)
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
        roomService.createRoom("byname", "desc", creatorId = owner.id)
        val found = roomService.getRoomByName("byname")
        assertNotNull(found)
        assertEquals("byname", found!!.name)
    }

    @Test
    fun `verifyRoomPassword returns true for public room`() {
        val room = roomService.createRoom("pub", "desc", creatorId = owner.id)
        assertTrue(roomService.verifyRoomPassword(room.id, null))
    }

    @Test
    fun `verifyRoomPassword validates correct password`() {
        val room = roomService.createRoom("priv", "desc", isPrivate = true, password = "secret", creatorId = owner.id)
        assertTrue(roomService.verifyRoomPassword(room.id, "secret"))
        assertFalse(roomService.verifyRoomPassword(room.id, "wrong"))
        assertFalse(roomService.verifyRoomPassword(room.id, null))
    }

    @Test
    fun `deleteRoom succeeds for owner`() {
        val room = roomService.createRoom("deleteme", "desc", creatorId = owner.id)
        // Owner (as creator) can delete — RoomService.deleteRoom(actorUser) checks canManageRoom
        assertTrue(roomService.deleteRoom(room.id, owner))
        assertNull(roomService.getRoomById(room.id))
    }

    @Test
    fun `deleteRoom fails for non-owner`() {
        val room = roomService.createRoom("protected", "desc", creatorId = owner.id)
        assertFalse(roomService.deleteRoom(room.id, other))
        assertNotNull(roomService.getRoomById(room.id))
    }

    @Test
    fun `updateRoom updates room metadata for owner`() {
        val room = roomService.createRoom("editable", "before", creatorId = owner.id)

        val updated = roomService.updateRoom(
            roomId = room.id,
            actorUser = owner,
            name = "edited-room",
            description = "after",
            isPrivate = true,
            password = "new-secret"
        )

        assertNotNull(updated)
        assertEquals("edited-room", updated!!.name)
        assertEquals("after", updated.description)
        assertTrue(updated.isPrivate)
        assertTrue(roomService.verifyRoomPassword(room.id, "new-secret"))
    }

    @Test
    fun `updateRoom keeps existing password when already private and password omitted`() {
        val room = roomService.createRoom(
            "private-edit",
            "desc",
            isPrivate = true,
            password = "old-secret",
            creatorId = owner.id
        )

        val updated = roomService.updateRoom(
            roomId = room.id,
            actorUser = owner,
            name = "private-edited",
            description = "updated-desc",
            isPrivate = true,
            password = null
        )

        assertNotNull(updated)
        assertEquals("private-edited", updated!!.name)
        assertTrue(updated.isPrivate)
        assertTrue(roomService.verifyRoomPassword(room.id, "old-secret"))
    }

    @Test
    fun `updateRoom updates room capacity for owner`() {
        val room = roomService.createRoom("capacity-edit", "desc", creatorId = owner.id, maxUsers = 100)
        val updated = roomService.updateRoom(
            roomId = room.id,
            actorUser = owner,
            name = room.name,
            description = room.description,
            isPrivate = room.isPrivate,
            password = null,
            maxUsers = 150
        )

        assertNotNull(updated)
        assertEquals(150, updated!!.maxUsers)
    }

    @Test
    fun `updateRoom public to private without password throws`() {
        val room = roomService.createRoom("public-edit", "desc", creatorId = owner.id)

        assertThrows<IllegalArgumentException> {
            roomService.updateRoom(
                roomId = room.id,
                actorUser = owner,
                name = "public-edit",
                description = "desc",
                isPrivate = true,
                password = null
            )
        }
    }

    @Test
    fun `updateRoom fails for non-owner`() {
        val room = roomService.createRoom("owner-only", "desc", creatorId = owner.id)

        val updated = roomService.updateRoom(
            roomId = room.id,
            actorUser = other,
            name = "hacked",
            description = "hacked-desc",
            isPrivate = false,
            password = null
        )

        assertNull(updated)
        val found = roomService.getRoomById(room.id)
        assertEquals("owner-only", found!!.name)
    }
}
