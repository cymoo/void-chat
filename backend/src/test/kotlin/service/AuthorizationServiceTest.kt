package service

import model.User
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class AuthorizationServiceTest {

    private val authorizationService = AuthorizationService()

    private fun user(id: Int, role: String): User = User(
        id = id,
        username = "user$id",
        role = role,
        createdAt = 0L,
        lastSeen = 0L
    )

    @Test
    fun `platform admin can access admin dashboard`() {
        assertTrue(authorizationService.canAccessAdminDashboard(user(1, "platform_admin")))
        assertTrue(authorizationService.canAccessAdminDashboard(user(2, "super_admin")))
        assertFalse(authorizationService.canAccessAdminDashboard(user(3, "user")))
    }

    @Test
    fun `platform admin can manage rooms without ownership`() {
        val actor = user(10, "platform_admin")
        assertTrue(authorizationService.canManageRoom(actor, roomCreatorId = 999))
    }

    @Test
    fun `room owner can manage own room`() {
        val actor = user(22, "user")
        assertTrue(authorizationService.canManageRoom(actor, roomCreatorId = 22))
        assertFalse(authorizationService.canManageRoom(actor, roomCreatorId = 99))
    }

    @Test
    fun `moderator can delete any message inside room`() {
        val actor = user(11, "user")
        assertTrue(authorizationService.canDeleteAnyMessage(actor, actorRoomRole = "moderator"))
        assertFalse(authorizationService.canDeleteAnyMessage(actor, actorRoomRole = "member"))
    }

    @Test
    fun `room role assignment validates allowed roles`() {
        assertTrue(authorizationService.isValidAssignableRoomRole("admin"))
        assertTrue(authorizationService.isValidAssignableRoomRole("moderator"))
        assertTrue(authorizationService.isValidAssignableRoomRole("member"))
        assertFalse(authorizationService.isValidAssignableRoomRole("owner"))
        assertFalse(authorizationService.isValidAssignableRoomRole("unknown"))
    }
}
