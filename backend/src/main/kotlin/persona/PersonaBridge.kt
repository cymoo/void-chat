package persona

import model.ChatMessage
import model.WsEvent
import repository.RoomMemberRepository
import repository.UserRepository
import service.AuthorizationService
import service.ChatService

/**
 * Bridge implementation connecting [PersonaChatEngine] to the application's
 * chat and user services.
 */
class PersonaBridge(
    private val chatService: ChatService,
    private val userRepo: UserRepository,
    private val roomMemberRepo: RoomMemberRepository
) : PersonaChatEngine.Bridge {

    override fun getRecentMessages(roomId: Int, limit: Int): List<PersonaChatEngine.ContextMessage> {
        return chatService.getRecentMessages(roomId, limit).mapNotNull { msg ->
            when (msg) {
                is ChatMessage.Text -> PersonaChatEngine.ContextMessage(
                    msg.userId, msg.username, msg.content, msg.id, msg.replyTo?.id
                )
                else -> null
            }
        }
    }

    override fun sendBotMessage(roomId: Int, botUserId: Int, content: String, replyToId: Int?) {
        val botUser = userRepo.findById(botUserId) ?: return
        chatService.sendBotTextMessage(roomId, botUser, content, replyToId)
    }

    override fun getOrCreateBotUser(username: String): PersonaChatEngine.BotIdentity {
        val existing = userRepo.findByUsername(username)
        if (existing != null) return PersonaChatEngine.BotIdentity(existing.id, existing.username)
        val created = userRepo.createUser(username, role = AuthorizationService.ROLE_BOT)
        return PersonaChatEngine.BotIdentity(created.id, created.username)
    }

    override fun addBotToRoom(roomId: Int, userId: Int) {
        roomMemberRepo.addMember(roomId, userId, "member")
    }

    override fun removeBotFromRoom(roomId: Int, userId: Int) {
        roomMemberRepo.removeMember(roomId, userId)
    }

    override fun broadcastRoomUsers(roomId: Int) {
        chatService.broadcastToRoom(roomId, WsEvent.Users(chatService.getRoomUsers(roomId)))
    }

    override fun sendTypingStatus(roomId: Int, userId: Int, username: String, isTyping: Boolean) {
        chatService.broadcastToRoom(roomId, WsEvent.Typing(userId, username, isTyping))
    }
}
