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
import org.junit.jupiter.api.Assertions.assertFalse
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

    private fun capturedMessages(conn: WsConnection): List<Map<*, *>> {
        val slot = mutableListOf<String>()
        verify { conn.send(capture(slot)) }
        return slot.map { objectMapper.readValue(it, Map::class.java) }
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

    // ---------------------------------------------------------------
    // Disabled user cannot send messages
    // ---------------------------------------------------------------

    @Test
    fun `disabled user cannot send room messages`() {
        val roomId = roomRepo.findByName("general")!!.id

        val superAdmin = userRepo.createUser("dis-super-admin", "hash")
        userRepo.updateRole(superAdmin.id, "super_admin")
        val superAdminFresh = userRepo.findById(superAdmin.id)!!

        val target = userRepo.createUser("dis-target-user", "hash")
        userService.updateUserDisabled(superAdminFresh, target.id, disabled = true, reason = "banned")

        val targetConn = mockConnection()
        chatService.joinRoom(roomId, targetConn, target)
        awaitBroadcasts()

        val sent = chatService.sendTextMessage(roomId, target, "should not send")
        assertFalse(sent, "Disabled user should not be able to send messages")
    }

    // ---------------------------------------------------------------
    // Regular member cannot kick
    // ---------------------------------------------------------------

    @Test
    fun `regular member cannot kick another user`() {
        val roomId = roomRepo.findByName("random")!!.id

        val member1 = userRepo.createUser("kick-member1", "hash")
        val member2 = userRepo.createUser("kick-member2", "hash")
        val conn1 = mockConnection()
        val conn2 = mockConnection()

        chatService.joinRoom(roomId, conn1, member1)
        chatService.joinRoom(roomId, conn2, member2)
        awaitBroadcasts()

        val kickResult = chatService.kickUser(roomId, member1, member2.id)

        assertFalse(kickResult, "Regular member should not be able to kick")
        assertTrue(
            chatService.getRoomUsers(roomId).any { it.id == member2.id },
            "member2 should still be in room after failed kick"
        )
    }

    // ---------------------------------------------------------------
    // Room admin cannot kick the room owner
    // ---------------------------------------------------------------

    @Test
    fun `room admin cannot kick the room owner`() {
        val owner = userRepo.createUser("kick-test-owner", "hash")
        val admin = userRepo.createUser("kick-test-admin", "hash")
        val specialRoom = roomRepo.create(
            name = "owner-kick-protect-room",
            description = "test",
            creatorId = owner.id
        )

        val ownerConn = mockConnection()
        val adminConn = mockConnection()

        chatService.joinRoom(specialRoom.id, ownerConn, owner)
        chatService.joinRoom(specialRoom.id, adminConn, admin)
        awaitBroadcasts()

        // Promote the admin via the owner's authority
        assertTrue(chatService.setUserRole(specialRoom.id, owner, admin.id, "admin"))

        val kickResult = chatService.kickUser(specialRoom.id, admin, owner.id)

        assertFalse(kickResult, "Room admin should not be able to kick the room owner")
        assertTrue(
            chatService.getRoomUsers(specialRoom.id).any { it.id == owner.id },
            "Owner should still be in room after failed kick"
        )
    }

    // ---------------------------------------------------------------
    // Muted user CAN still send private messages
    // ---------------------------------------------------------------

    @Test
    fun `muted user can send private messages (mute only blocks room messages)`() {
        val superAdmin = userRepo.createUser("mute-pm-admin", "hash")
        userRepo.updateRole(superAdmin.id, "super_admin")
        val superAdminFresh = userRepo.findById(superAdmin.id)!!

        val userA = userRepo.createUser("mute-pm-sender", "hash")
        val userB = userRepo.createUser("mute-pm-receiver", "hash")

        userService.updateUserMute(superAdminFresh, userA.id, muted = true, durationMinutes = 60, reason = "spam")

        val connA = mockConnection()
        val connB = mockConnection()
        chatService.attachDirectConnection(userA.id, connA)
        chatService.attachDirectConnection(userB.id, connB)

        chatService.sendPrivateMessage(
            sender = userA,
            receiverId = userB.id,
            messageType = "text",
            content = "private despite mute"
        )
        awaitBroadcasts()

        val pmEvents = capturedMessages(connB).filter { it["type"] == "private_message" }
        assertTrue(pmEvents.isNotEmpty(), "Muted user's private message should still be delivered")
        @Suppress("UNCHECKED_CAST")
        val pm = pmEvents.first()["message"] as Map<String, Any>
        assertEquals("private despite mute", pm["content"])
    }
}
