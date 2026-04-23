package controller

import io.github.cymoo.colleen.*
import model.*
import repository.MessageRepository
import repository.PrivateMessageRepository
import repository.RoomMemberRepository
import service.AuthorizationService
import service.ChatService
import service.FileService
import service.InvitationService
import service.RoomService
import service.SessionService
import service.UserService
import util.AuthHelper
import util.BearerToken

/**
 * REST API controller for rooms, files, user profiles, and admin operations.
 */
@Controller("/api")
class ApiController(
    private val roomService: RoomService,
    private val fileService: FileService,
    private val userService: UserService,
    private val invitationService: InvitationService,
    private val sessionService: SessionService,
    private val chatService: ChatService,
    private val authorizationService: AuthorizationService,
    private val messageRepo: MessageRepository,
    private val privateMessageRepo: PrivateMessageRepository,
    private val roomMemberRepo: RoomMemberRepository,
) {

    @Get("/rooms")
    fun getRooms(): List<RoomInfo> {
        val rooms = roomService.getAllRooms()
        val onlineCounts = chatService.getOnlineUserCounts()
        return rooms.map { it.copy(onlineUsers = onlineCounts[it.id] ?: 0) }
    }

    @Post("/rooms")
    fun createRoom(body: Json<CreateRoomRequest>, token: BearerToken): Room {
        val actor = requireAuthUser(token)
        val request = body.value
        if (request.name.isBlank()) throw BadRequest("Room name is required")
        if (request.isPrivate && request.password.isNullOrBlank()) throw BadRequest("Private rooms require a password")
        return try {
            roomService.createRoom(
                name = request.name,
                description = request.description,
                isPrivate = request.isPrivate,
                password = request.password,
                creatorId = actor.id,
                maxUsers = request.maxUsers
            )
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to create room")
        }
    }

    @Patch("/rooms/{roomId}")
    fun updateRoom(roomId: Path<Int>, body: Json<UpdateRoomRequest>, token: BearerToken): Room {
        val actor = requireAuthUser(token)
        val request = body.value
        if (request.name.isBlank()) throw BadRequest("Room name is required")
        return try {
            roomService.updateRoom(
                roomId = roomId.value,
                actorUser = actor,
                name = request.name,
                description = request.description,
                isPrivate = request.isPrivate,
                password = request.password,
                maxUsers = request.maxUsers
            ) ?: throw BadRequest("Cannot update room: not found or insufficient permission")
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to update room")
        }
    }

    @Delete("/rooms/{roomId}")
    fun deleteRoom(ctx: Context, roomId: Path<Int>, token: BearerToken) {
        val actor = requireAuthUser(token)
        if (!roomService.deleteRoom(roomId.value, actor)) {
            throw BadRequest("Cannot delete room: not found or insufficient permission")
        }
        ctx.status(204)
    }

    @Post("/upload/image")
    fun uploadImage(image: UploadedFile, token: BearerToken): UploadResponse {
        requireAuthUser(token)
        return try {
            val file = image.value ?: throw BadRequest("No image uploaded")
            val fileInfo = fileService.saveImage(file)
            UploadResponse(
                success = true, url = fileInfo.fileUrl, thumbnail = fileInfo.thumbnailUrl,
                fileName = fileInfo.fileName, fileSize = fileInfo.fileSize,
                width = fileInfo.width, height = fileInfo.height
            )
        } catch (e: IllegalArgumentException) {
            UploadResponse(success = false, error = e.message)
        }
    }

    @Post("/upload/file")
    fun uploadFile(file: UploadedFile, token: BearerToken): UploadResponse {
        requireAuthUser(token)
        return try {
            val f = file.value ?: throw BadRequest("No file uploaded")
            val fileInfo = fileService.saveFile(f)
            UploadResponse(success = true, url = fileInfo.fileUrl, fileName = fileInfo.fileName, fileSize = fileInfo.fileSize)
        } catch (e: IllegalArgumentException) {
            UploadResponse(success = false, error = e.message)
        }
    }

    @Get("/users/{userId}")
    fun getUser(userId: Path<Int>): User {
        return userService.getUserById(userId.value) ?: throw NotFound("User not found")
    }

    @Get("/users/by-name/{username}")
    fun getUserByName(username: Path<String>): User {
        return userService.getUserByUsername(username.value) ?: throw NotFound("User not found")
    }

    @Get("/dms/unread-senders")
    fun getUnreadDmSenders(token: BearerToken): List<UnreadSender> {
        val actor = requireAuthUser(token)
        return chatService.getUnreadDmSenders(actor.id)
    }

    @Get("/dms/inbox")
    fun getDmInbox(token: BearerToken): List<DmInboxEntry> {
        val actor = requireAuthUser(token)
        return chatService.getDmInbox(actor.id)
    }

    @Patch("/users/me")
    fun updateMyProfile(body: Json<UpdateProfileRequest>, token: BearerToken): User {
        val actor = requireAuthUser(token)
        val req = body.value
        return try {
            val updated = userService.updateProfile(
                userId = actor.id,
                username = req.username,
                avatarUrl = req.avatarUrl,
                bio = req.bio,
                status = req.status
            ) ?: throw NotFound("User not found")
            chatService.broadcastUserUpdate(updated)
            updated
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to update profile")
        }
    }

    @Get("/admin/dashboard")
    fun getAdminDashboard(token: BearerToken): AdminDashboardResponse {
        requireAdmin(token)
        val rooms = getRooms()
        val users = userService.listUsers()
        val invites = invitationService.listInvites()
        val registrationMode = invitationService.getRegistrationMode()
        return AdminDashboardResponse(
            users = users,
            rooms = rooms,
            registrationMode = registrationMode,
            invites = invites
        )
    }

    @Patch("/admin/users/{userId}/role")
    fun updateAdminUserRole(userId: Path<Int>, body: Json<UpdateUserRoleRequest>, token: BearerToken): User {
        val actor = requireAdmin(token)
        val req = body.value
        if (req.role.isBlank()) throw BadRequest("Role is required")

        return try {
            userService.updateUserRole(actor, userId.value, req.role)
                ?: throw NotFound("User not found")
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to update role")
        }
    }

    @Patch("/admin/users/{userId}/profile")
    fun updateAdminUserProfile(userId: Path<Int>, body: Json<UpdateProfileRequest>, token: BearerToken): User {
        requireAdmin(token)
        val req = body.value
        return try {
            userService.updateProfile(userId.value, req.username, req.avatarUrl, req.bio, req.status)
                ?: throw NotFound("User not found")
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to update profile")
        }
    }

    @Patch("/admin/users/{userId}/disable")
    fun updateAdminUserDisabled(userId: Path<Int>, body: Json<UpdateUserDisableRequest>, token: BearerToken): User {
        val actor = requireAdmin(token)
        val req = body.value
        return try {
            val updated = userService.updateUserDisabled(
                actorUser = actor,
                targetUserId = userId.value,
                disabled = req.disabled,
                reason = req.reason
            ) ?: throw NotFound("User not found")
            if (updated.isDisabled) {
                sessionService.invalidateSessionsForUser(updated.id)
            }
            updated
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to update disabled state")
        }
    }

    @Patch("/admin/users/{userId}/mute")
    fun updateAdminUserMute(userId: Path<Int>, body: Json<UpdateUserMuteRequest>, token: BearerToken): User {
        val actor = requireAdmin(token)
        val req = body.value
        return try {
            userService.updateUserMute(
                actorUser = actor,
                targetUserId = userId.value,
                muted = req.muted,
                durationMinutes = req.durationMinutes,
                reason = req.reason
            ) ?: throw NotFound("User not found")
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to update mute state")
        }
    }

    @Post("/admin/invites")
    fun createAdminInvite(body: Json<CreateInviteLinkRequest>, token: BearerToken): CreateInviteLinkResponse {
        val actor = requireAdmin(token)
        val req = body.value
        return try {
            invitationService.createInvite(
                createdByUserId = actor.id,
                maxUses = req.maxUses,
                expiresInHours = req.expiresInHours
            )
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to create invite")
        }
    }

    @Patch("/admin/invites/{inviteId}/revoke")
    fun revokeAdminInvite(inviteId: Path<Int>, token: BearerToken): InviteLink {
        requireAdmin(token)
        return invitationService.revokeInvite(inviteId.value) ?: throw NotFound("Invite not found")
    }

    @Patch("/admin/registration-mode")
    fun updateRegistrationMode(body: Json<UpdateRegistrationModeRequest>, token: BearerToken): RegistrationModeResponse {
        requireAdmin(token)
        val req = body.value
        return try {
            RegistrationModeResponse(mode = invitationService.updateRegistrationMode(req.mode))
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to update registration mode")
        }
    }

    @Get("/rooms/{roomId}/export")
    fun exportRoom(roomId: Path<Int>, token: BearerToken): List<ChatMessage> {
        val actor = requireAuthUser(token)
        if (roomMemberRepo.getMemberRole(roomId.value, actor.id) == null) {
            throw Unauthorized("You are not a member of this room")
        }
        return messageRepo.getAllMessages(roomId.value)
    }

    @Get("/dm/{userId}/export")
    fun exportDm(userId: Path<Int>, token: BearerToken): List<PrivateMessage> {
        val actor = requireAuthUser(token)
        return privateMessageRepo.getAllMessages(actor.id, userId.value)
    }

    private fun requireAuthUser(token: BearerToken): User =
        AuthHelper.requireAuthUser(token, sessionService, userService)

    private fun requireAdmin(token: BearerToken): User =
        AuthHelper.requireAdmin(token, sessionService, userService, authorizationService)
}
