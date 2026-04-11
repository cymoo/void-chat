package model

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

/**
 * User model
 */
data class UserCapabilities(
    val canAccessAdminDashboard: Boolean,
    val canManagePlatformUsers: Boolean
)

data class User(
    val id: Int,
    val username: String,
    val avatarUrl: String? = null,
    val bio: String? = null,
    val status: String? = null,
    val role: String? = null,
    val capabilities: UserCapabilities? = null,
    val isDisabled: Boolean = false,
    val disabledReason: String? = null,
    val mutedUntil: Long? = null,
    val muteReason: String? = null,
    val isMuted: Boolean = false,
    val createdAt: Long,
    val lastSeen: Long
)

/**
 * Room model
 */
data class Room(
    val id: Int,
    val name: String,
    val description: String?,
    val isPrivate: Boolean = false,
    val creatorId: Int? = null,
    val createdAt: Long,
    val maxUsers: Int = 100
)

/**
 * Room with online user count
 */
data class RoomInfo(
    val id: Int,
    val name: String,
    val description: String?,
    val isPrivate: Boolean = false,
    val creatorId: Int? = null,
    val onlineUsers: Int,
    val maxUsers: Int
)

/**
 * Base message type with discriminator for JSON serialization
 */
@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = "messageType"
)
@JsonSubTypes(
    JsonSubTypes.Type(value = ChatMessage.Text::class, name = "text"),
    JsonSubTypes.Type(value = ChatMessage.Image::class, name = "image"),
    JsonSubTypes.Type(value = ChatMessage.File::class, name = "file"),
    JsonSubTypes.Type(value = ChatMessage.System::class, name = "system")
)
sealed class ChatMessage {
    abstract val id: Int
    abstract val timestamp: Long
    abstract val replyTo: ReplyInfo?

    data class Text(
        override val id: Int,
        val userId: Int,
        val username: String,
        val avatarUrl: String?,
        val content: String,
        val editedAt: Long? = null,
        override val timestamp: Long,
        override val replyTo: ReplyInfo? = null
    ) : ChatMessage()

    data class Image(
        override val id: Int,
        val userId: Int,
        val username: String,
        val avatarUrl: String?,
        val imageUrl: String,
        val thumbnailUrl: String?,
        override val timestamp: Long,
        override val replyTo: ReplyInfo? = null
    ) : ChatMessage()

    data class File(
        override val id: Int,
        val userId: Int,
        val username: String,
        val avatarUrl: String?,
        val fileName: String,
        val fileUrl: String,
        val fileSize: Long,
        val mimeType: String,
        override val timestamp: Long,
        override val replyTo: ReplyInfo? = null
    ) : ChatMessage()

    data class System(
        override val id: Int,
        val content: String,
        override val timestamp: Long,
        override val replyTo: ReplyInfo? = null
    ) : ChatMessage()
}

/**
 * Reply reference info (summary of replied-to message)
 */
data class ReplyInfo(
    val id: Int,
    val username: String,
    val content: String,
    val messageType: String
)

/**
 * Private message model
 */
data class PrivateMessage(
    val id: Int,
    val senderId: Int,
    val senderUsername: String,
    val senderAvatarUrl: String?,
    val receiverId: Int,
    val receiverUsername: String,
    val messageType: String,
    val content: String? = null,
    val fileUrl: String? = null,
    val fileName: String? = null,
    val fileSize: Long? = null,
    val mimeType: String? = null,
    val thumbnailUrl: String? = null,
    val isRead: Boolean = false,
    val timestamp: Long
)

/**
 * File information
 */
data class FileInfo(
    val fileName: String,
    val fileUrl: String,
    val fileSize: Long,
    val mimeType: String,
    val thumbnailUrl: String? = null
)

/**
 * Unread DM sender info
 */
data class UnreadSender(
    val senderId: Int,
    val senderUsername: String,
    val unreadCount: Int
)

/**
 * WebSocket message payloads
 */
data class WsMessagePayload(
    val type: String,
    val content: String? = null,
    val imageUrl: String? = null,
    val thumbnailUrl: String? = null,
    val fileName: String? = null,
    val fileUrl: String? = null,
    val fileSize: Long? = null,
    val mimeType: String? = null,
    val messageId: Int? = null,
    val targetUserId: Int? = null,
    val replyToId: Int? = null,
    val beforeId: Int? = null,
    val query: String? = null,
    val role: String? = null,
    val duration: Int? = null,
    val isTyping: Boolean? = null,
    val bio: String? = null,
    val status: String? = null,
    val avatarUrl: String? = null
)

/**
 * WebSocket event types sent to clients
 */
sealed class WsEvent {
    data class History(val messages: List<ChatMessage>, val hasMore: Boolean = false) : WsEvent()
    data class Users(val users: List<User>) : WsEvent()
    data class Message(val message: ChatMessage) : WsEvent()
    data class UserJoined(val user: User) : WsEvent()
    data class UserLeft(val userId: Int, val username: String) : WsEvent()
    data class Error(val message: String) : WsEvent()
    data class MessageEdited(val messageId: Int, val content: String, val editedAt: Long) : WsEvent()
    data class MessageDeleted(val messageId: Int) : WsEvent()
    data class PrivateMessageEvent(val message: PrivateMessage) : WsEvent()
    data class PrivateHistory(val messages: List<PrivateMessage>, val hasMore: Boolean = false) : WsEvent()
    data class Mention(val messageId: Int, val mentionedBy: String, val content: String) : WsEvent()
    data class UserUpdated(val user: User) : WsEvent()
    data class Kicked(val reason: String) : WsEvent()
    data class RoleChanged(val userId: Int, val role: String) : WsEvent()
    data class SearchResults(val messages: List<ChatMessage>, val query: String) : WsEvent()
    data class UnreadCounts(val unreadDms: Int) : WsEvent()
    data class Typing(val userId: Int, val username: String, val isTyping: Boolean) : WsEvent()
}

/**
 * API request/response models
 */
data class CreateRoomRequest(
    val name: String,
    val description: String?,
    val isPrivate: Boolean = false,
    val password: String? = null
)

data class UpdateRoomRequest(
    val name: String,
    val description: String?,
    val isPrivate: Boolean = false,
    val password: String? = null
)

data class RegisterRequest(
    val username: String,
    val password: String,
    val inviteCode: String? = null
)

data class LoginRequest(
    val username: String,
    val password: String
)

data class AuthResponse(
    val token: String,
    val user: User
)

data class UpdateProfileRequest(
    val avatarUrl: String? = null,
    val bio: String? = null,
    val status: String? = null
)

data class UpdateUserRoleRequest(
    val role: String
)

data class AdminDashboardResponse(
    val users: List<User>,
    val rooms: List<RoomInfo>,
    val registrationMode: String = "open",
    val invites: List<InviteLink> = emptyList()
)

data class UploadResponse(
    val success: Boolean,
    val url: String? = null,
    val thumbnail: String? = null,
    val fileName: String? = null,
    val fileSize: Long? = null,
    val error: String? = null
)

data class InviteLink(
    val id: Int,
    val codePreview: String,
    val createdByUserId: Int,
    val createdByUsername: String? = null,
    val maxUses: Int? = null,
    val usedCount: Int,
    val expiresAt: Long? = null,
    val revokedAt: Long? = null,
    val createdAt: Long,
    val isActive: Boolean
)

data class CreateInviteLinkRequest(
    val maxUses: Int? = null,
    val expiresInHours: Int? = null
)

data class CreateInviteLinkResponse(
    val invite: InviteLink,
    val code: String
)

data class UpdateUserDisableRequest(
    val disabled: Boolean,
    val reason: String? = null
)

data class UpdateUserMuteRequest(
    val muted: Boolean,
    val durationMinutes: Int? = null,
    val reason: String? = null
)

data class UpdateRegistrationModeRequest(
    val mode: String
)

data class RegistrationModeResponse(
    val mode: String
)
