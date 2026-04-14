package repository

import org.jooq.DSLContext
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class PrivateMessageRepositoryTest {

    private lateinit var pmRepo: PrivateMessageRepository
    private lateinit var userRepo: UserRepository
    private lateinit var dsl: DSLContext
    private var senderId = 0
    private var receiverId = 0

    @BeforeEach
    fun setUp() {
        dsl = TestDatabase.createDsl()
        pmRepo = PrivateMessageRepository(dsl)
        userRepo = UserRepository(dsl)

        senderId = userRepo.createUser("sender", "hash").id
        receiverId = userRepo.createUser("receiver", "hash").id
    }

    @Test
    fun `saveTextMessage and retrieve in conversation`() {
        val msgId = pmRepo.saveTextMessage(senderId, receiverId, "hello")
        assertTrue(msgId > 0)

        val messages = pmRepo.getConversation(senderId, receiverId)
        assertEquals(1, messages.size)
        assertEquals("text", messages[0].messageType)
        assertEquals("hello", messages[0].content)
    }

    @Test
    fun `saveImageMessage stores url and thumbnail`() {
        val msgId = pmRepo.saveImageMessage(senderId, receiverId, "/uploads/img.png", "/uploads/thumb.png")
        assertTrue(msgId > 0)

        val messages = pmRepo.getConversation(senderId, receiverId)
        val img = messages.find { it.id == msgId }!!
        assertEquals("image", img.messageType)
        assertEquals("/uploads/img.png", img.fileUrl)
        assertEquals("/uploads/thumb.png", img.thumbnailUrl)
    }

    @Test
    fun `saveFileMessage stores file metadata`() {
        val msgId = pmRepo.saveFileMessage(senderId, receiverId, "doc.pdf", "/uploads/doc.pdf", 2048, "application/pdf")
        assertTrue(msgId > 0)

        val messages = pmRepo.getConversation(senderId, receiverId)
        val file = messages.find { it.id == msgId }!!
        assertEquals("file", file.messageType)
        assertEquals("doc.pdf", file.fileName)
        assertEquals(2048L, file.fileSize)
        assertEquals("application/pdf", file.mimeType)
    }

    @Test
    fun `conversation is visible from both sides`() {
        pmRepo.saveTextMessage(senderId, receiverId, "msg1")
        pmRepo.saveTextMessage(receiverId, senderId, "msg2")

        val fromSender = pmRepo.getConversation(senderId, receiverId)
        val fromReceiver = pmRepo.getConversation(receiverId, senderId)
        assertEquals(fromSender.size, fromReceiver.size)
        assertEquals(2, fromSender.size)
    }

    @Test
    fun `markAsRead updates unread count`() {
        pmRepo.saveTextMessage(senderId, receiverId, "unread1")
        pmRepo.saveTextMessage(senderId, receiverId, "unread2")

        assertEquals(2, pmRepo.getUnreadCount(receiverId))

        pmRepo.markAsRead(senderId, receiverId)
        assertEquals(0, pmRepo.getUnreadCount(receiverId))
    }

    @Test
    fun `getUnreadSenders returns sender info`() {
        pmRepo.saveTextMessage(senderId, receiverId, "hey")

        val senders = pmRepo.getUnreadSenders(receiverId)
        assertEquals(1, senders.size)
        assertEquals(senderId, senders[0].senderId)
        assertEquals(1, senders[0].unreadCount)
    }

    @Test
    fun `getInbox returns latest message per conversation`() {
        pmRepo.saveTextMessage(senderId, receiverId, "first")
        pmRepo.saveTextMessage(senderId, receiverId, "second")

        val inbox = pmRepo.getInbox(receiverId)
        assertEquals(1, inbox.size)
        assertEquals("second", inbox[0].latestMessagePreview)
    }

    @Test
    fun `getConversation respects limit and pagination`() {
        repeat(5) { pmRepo.saveTextMessage(senderId, receiverId, "msg $it") }

        val page1 = pmRepo.getConversation(senderId, receiverId, limit = 3)
        assertEquals(3, page1.size)

        val page2 = pmRepo.getConversation(senderId, receiverId, limit = 3, beforeId = page1.first().id)
        assertEquals(2, page2.size)
    }
}
