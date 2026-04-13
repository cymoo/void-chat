package service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.github.cymoo.colleen.ws.WsConnection
import io.mockk.Runs
import io.mockk.clearAllMocks
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import repository.RoomRepository
import repository.UserRepository

class ChatServiceAuthzTest {
    private val objectMapper = jacksonObjectMapper()
    private val dsl = TestDatabase.createDsl()

    private val chatService = ChatService(dsl, objectMapper)
    private val userRepo = UserRepository(dsl)
    private val roomRepo = RoomRepository(dsl)
    private val userService = UserService(dsl)

    private fun mockConnection(): WsConnection {
        val conn = mockk<WsConnection>(relaxed = true)
        every { conn.send(any<String>()) } just Runs
        return conn
    }

    private fun awaitBroadcasts() {
        java.util.concurrent.CompletableFuture.runAsync({}, chatService.broadcastExecutorForTest())
            .get(2, java.util.concurrent.TimeUnit.SECONDS)
    }

    @BeforeEach
    fun setUp() {
        clearAllMocks()
    }

    @Test
    fun `platform admin can set room role and kick without room admin role`() {
        val roomId = roomRepo.findByName("general")!!.id

        val platformAdmin = userRepo.createUser("platform-admin", "hash")
        userRepo.updateRole(platformAdmin.id, "platform_admin")
        val platformAdminActor = userRepo.findById(platformAdmin.id)!!
        val target = userRepo.createUser("target-user", "hash")

        val adminConn = mockConnection()
        val targetConn = mockConnection()

        chatService.joinRoom(roomId, adminConn, platformAdminActor)
        chatService.joinRoom(roomId, targetConn, target)
        awaitBroadcasts()

        val setRoleOk = chatService.setUserRole(roomId, platformAdminActor, target.id, "moderator")
        assertTrue(setRoleOk)

        val targetAfterRoleChange = chatService.getRoomUsers(roomId).first { it.id == target.id }
        assertEquals("moderator", targetAfterRoleChange.role)

        val kickOk = chatService.kickUser(roomId, platformAdminActor, target.id)
        assertTrue(kickOk)
        verify(atLeast = 1) { targetConn.send(any<String>()) }
        verify(atLeast = 1) { targetConn.close() }
    }

    @Test
    fun `muted user cannot send room text message`() {
        val roomId = roomRepo.findByName("general")!!.id

        val superAdmin = userService.register("root", "password123").user
        val target = userService.register("muted-user", "password123").user
        userService.updateUserMute(superAdmin, target.id, muted = true, durationMinutes = 60, reason = "spam")

        val targetConn = mockConnection()
        chatService.joinRoom(roomId, targetConn, target)
        awaitBroadcasts()

        val sent = chatService.sendTextMessage(roomId, target, "hello")
        assertEquals(false, sent)
    }
}
