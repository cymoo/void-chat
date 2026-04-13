package repository

import org.jooq.DSLContext
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class MessageRepositoryTest {

    private lateinit var messageRepo: MessageRepository
    private lateinit var userRepo: UserRepository
    private lateinit var dsl: DSLContext
    private var roomId = 0
    private var userId = 0

    @BeforeEach
    fun setUp() {
        dsl = TestDatabase.createDsl()
        messageRepo = MessageRepository(dsl)
        userRepo = UserRepository(dsl)

        // Create a test user and use the default "general" room
        val user = userRepo.createUser("testuser", "hash")
        userId = user.id
        roomId = RoomRepository(dsl).findByName("general")!!.id
    }

    @Test
    fun `saveTextMessage and retrieve in recent messages`() {
        val msgId = messageRepo.saveTextMessage(roomId, userId, "hello world")
        assertTrue(msgId > 0)

        val messages = messageRepo.getRecentMessages(roomId)
        assertTrue(messages.any { it.id == msgId })
    }

    @Test
    fun `saveSystemMessage creates message with null user`() {
        val msgId = messageRepo.saveSystemMessage(roomId, "user joined")
        assertTrue(msgId > 0)

        // System messages are filtered from getRecentMessages
        val messages = messageRepo.getRecentMessages(roomId)
        assertFalse(messages.any { it.id == msgId }, "System messages should be excluded from recent messages")
    }

    @Test
    fun `updateMessage edits content and sets editedAt`() {
        val msgId = messageRepo.saveTextMessage(roomId, userId, "original")
        assertTrue(messageRepo.updateMessage(msgId, userId, "edited"))

        val messages = messageRepo.getRecentMessages(roomId)
        val msg = messages.find { it.id == msgId } as model.ChatMessage.Text
        assertEquals("edited", msg.content)
        assertNotNull(msg.editedAt)
    }

    @Test
    fun `updateMessage fails for wrong user`() {
        val msgId = messageRepo.saveTextMessage(roomId, userId, "original")
        assertFalse(messageRepo.updateMessage(msgId, 9999, "hacked"))
    }

    @Test
    fun `softDeleteMessage hides message from recent`() {
        val msgId = messageRepo.saveTextMessage(roomId, userId, "delete me")
        assertTrue(messageRepo.softDeleteMessage(msgId, userId))

        val messages = messageRepo.getRecentMessages(roomId)
        assertFalse(messages.any { it.id == msgId })
    }

    @Test
    fun `adminDeleteMessage hides message regardless of user`() {
        val msgId = messageRepo.saveTextMessage(roomId, userId, "admin delete")
        assertTrue(messageRepo.adminDeleteMessage(msgId))

        val messages = messageRepo.getRecentMessages(roomId)
        assertFalse(messages.any { it.id == msgId })
    }

    @Test
    fun `getMessagesBefore returns paginated results`() {
        // Create 5 messages
        val ids = (1..5).map { messageRepo.saveTextMessage(roomId, userId, "msg $it") }

        // Get messages before the last one
        val before = messageRepo.getMessagesBefore(roomId, ids.last())
        assertTrue(before.size <= 4)
        assertTrue(before.all { it.id < ids.last() })
    }

    @Test
    fun `searchMessages finds matching content`() {
        messageRepo.saveTextMessage(roomId, userId, "hello world")
        messageRepo.saveTextMessage(roomId, userId, "goodbye world")
        messageRepo.saveTextMessage(roomId, userId, "hello chat")

        val results = messageRepo.searchMessages(roomId, "hello")
        assertEquals(2, results.size)
    }

    @Test
    fun `searchMessages escapes special characters`() {
        messageRepo.saveTextMessage(roomId, userId, "100% done")
        messageRepo.saveTextMessage(roomId, userId, "50% done")
        messageRepo.saveTextMessage(roomId, userId, "not done")

        val results = messageRepo.searchMessages(roomId, "% done")
        assertEquals(2, results.size)
    }

    @Test
    fun `saveTextMessage with reply creates reply info`() {
        val originalId = messageRepo.saveTextMessage(roomId, userId, "original message")
        val replyId = messageRepo.saveTextMessage(roomId, userId, "reply text", replyToId = originalId)

        val messages = messageRepo.getRecentMessages(roomId)
        val reply = messages.find { it.id == replyId } as model.ChatMessage.Text
        assertNotNull(reply.replyTo)
        assertEquals(originalId, reply.replyTo!!.id)
        assertEquals("original message", reply.replyTo!!.content)
    }

    @Test
    fun `saveImageMessage stores image correctly`() {
        val msgId = messageRepo.saveImageMessage(roomId, userId, "/uploads/img.png", "/uploads/thumb.png")
        val messages = messageRepo.getRecentMessages(roomId)
        val img = messages.find { it.id == msgId } as model.ChatMessage.Image
        assertEquals("/uploads/img.png", img.imageUrl)
        assertEquals("/uploads/thumb.png", img.thumbnailUrl)
    }

    @Test
    fun `saveFileMessage stores file correctly`() {
        val msgId = messageRepo.saveFileMessage(roomId, userId, "doc.pdf", "/uploads/doc.pdf", 1024, "application/pdf")
        val messages = messageRepo.getRecentMessages(roomId)
        val file = messages.find { it.id == msgId } as model.ChatMessage.File
        assertEquals("doc.pdf", file.fileName)
        assertEquals(1024L, file.fileSize)
        assertEquals("application/pdf", file.mimeType)
    }
}
