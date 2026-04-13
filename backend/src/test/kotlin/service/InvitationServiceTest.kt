package service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class InvitationServiceTest {

    @Test
    fun `registration mode defaults to open`() {
        val dsl = TestDatabase.createDsl()
        val invitationService = InvitationService(dsl)

        assertEquals("open", invitationService.getRegistrationMode())
    }

    @Test
    fun `invite only mode requires invite code`() {
        val dsl = TestDatabase.createDsl()

        val userService = UserService(dsl)
        val invitationService = InvitationService(dsl)
        val admin = userService.register("root", "password123").user

        invitationService.updateRegistrationMode("invite_only")
        assertThrows(IllegalArgumentException::class.java) {
            invitationService.validateAndConsumeRegistrationInvite(null)
        }

        val created = invitationService.createInvite(createdByUserId = admin.id, maxUses = 1, expiresInHours = 24)
        assertNotNull(created.code)
        invitationService.validateAndConsumeRegistrationInvite(created.code)

        assertThrows(IllegalArgumentException::class.java) {
            invitationService.validateAndConsumeRegistrationInvite(created.code)
        }
    }

    @Test
    fun `open mode still accepts optional invite code`() {
        val dsl = TestDatabase.createDsl()

        val userService = UserService(dsl)
        val invitationService = InvitationService(dsl)
        val admin = userService.register("root", "password123").user

        val created = invitationService.createInvite(createdByUserId = admin.id, maxUses = 2, expiresInHours = 24)
        invitationService.validateAndConsumeRegistrationInvite(created.code)
        invitationService.validateAndConsumeRegistrationInvite(null)

        val list = invitationService.listInvites()
        val invite = list.first { it.id == created.invite.id }
        assertEquals(1, invite.usedCount)
    }
}
