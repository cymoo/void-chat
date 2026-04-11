package controller

import io.github.cymoo.colleen.*
import model.*
import service.AuthorizationService
import service.ChatService
import service.FileService
import service.RoomService
import service.SessionService
import service.UserService
import util.BearerToken

/**
 * REST API controller for rooms, files, user profiles, and admin operations.
 */
@Controller("/api")
class ApiController(
    private val roomService: RoomService,
    private val fileService: FileService,
    private val userService: UserService,
    private val sessionService: SessionService,
    private val chatService: ChatService,
    private val authorizationService: AuthorizationService
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
        return roomService.createRoom(request.name, request.description, request.isPrivate, request.password, actor.id)
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
                password = request.password
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
            UploadResponse(success = true, url = fileInfo.fileUrl, thumbnail = fileInfo.thumbnailUrl, fileName = fileInfo.fileName, fileSize = fileInfo.fileSize)
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

    @Patch("/users/me")
    fun updateMyProfile(body: Json<UpdateProfileRequest>, token: BearerToken): User {
        val actor = requireAuthUser(token)
        val req = body.value
        return userService.updateProfile(actor.id, req.avatarUrl, req.bio, req.status)
            ?: throw NotFound("User not found")
    }

    @Get("/admin/dashboard")
    fun getAdminDashboard(token: BearerToken): AdminDashboardResponse {
        val actor = requireAuthUser(token)
        requireAdminAccess(actor)
        val rooms = getRooms()
        val users = userService.listUsers()
        return AdminDashboardResponse(users = users, rooms = rooms)
    }

    @Patch("/admin/users/{userId}/role")
    fun updateAdminUserRole(userId: Path<Int>, body: Json<UpdateUserRoleRequest>, token: BearerToken): User {
        val actor = requireAuthUser(token)
        if (!authorizationService.canManagePlatformUsers(actor)) {
            throw Unauthorized("Admin permission required")
        }

        val req = body.value
        if (req.role.isBlank()) throw BadRequest("Role is required")

        return try {
            userService.updateUserRole(actor, userId.value, req.role)
                ?: throw NotFound("User not found")
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Failed to update role")
        }
    }

    private fun requireAuthUser(token: BearerToken): User {
        val userId = sessionService.validateSession(token.require()) ?: throw Unauthorized("Invalid or expired session")
        return userService.getUserById(userId) ?: throw NotFound("User not found")
    }

    private fun requireAdminAccess(user: User) {
        if (!authorizationService.canAccessAdminDashboard(user)) {
            throw Unauthorized("Admin access required")
        }
    }
}
