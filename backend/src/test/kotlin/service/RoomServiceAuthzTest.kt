package service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import repository.UserRepository

class RoomServiceAuthzTest {

    private lateinit var roomService: RoomService
    private lateinit var userRepo: UserRepository
    private var ownerId = 0
    private var platformAdminId = 0

    @BeforeEach
    fun setUp() {
        val dsl = TestDatabase.createDsl()
        roomService = RoomService(dsl)
        userRepo = UserRepository(dsl)

        ownerId = userRepo.createUser("owner", "hash").id
        platformAdminId = userRepo.createUser("platform-admin", "hash").id
        userRepo.updateRole(platformAdminId, "platform_admin")
    }

    @Test
    fun `platform admin can update room created by another user`() {
        val room = roomService.createRoom("owner-room", "initial", creatorId = ownerId)
        val platformAdmin = userRepo.findById(platformAdminId)!!

        val updated = roomService.updateRoom(
            roomId = room.id,
            actorUser = platformAdmin,
            name = "updated-by-admin",
            description = "updated",
            isPrivate = false,
            password = null
        )

        assertNotNull(updated)
        assertEquals("updated-by-admin", updated!!.name)
    }

    @Test
    fun `platform admin can delete room created by another user`() {
        val room = roomService.createRoom("to-delete", "desc", creatorId = ownerId)
        val platformAdmin = userRepo.findById(platformAdminId)!!

        val deleted = roomService.deleteRoom(room.id, platformAdmin)
        assertTrue(deleted)
        assertNull(roomService.getRoomById(room.id))
    }
}
