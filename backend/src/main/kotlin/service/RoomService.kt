package service

import model.Room
import model.RoomInfo
import model.User
import org.jooq.DSLContext
import repository.RoomRepository
import util.PasswordUtils

/**
 * Room management service
 */
class RoomService(
    dsl: DSLContext,
    private val authorizationService: AuthorizationService = AuthorizationService()
) {

    private val roomRepo = RoomRepository(dsl)

    fun getAllRooms(): List<RoomInfo> {
        return roomRepo.findAll().map { room ->
            RoomInfo(
                id = room.id,
                name = room.name,
                description = room.description,
                isPrivate = room.isPrivate,
                creatorId = room.creatorId,
                onlineUsers = 0,
                maxUsers = room.maxUsers
            )
        }
    }

    fun getRoomById(id: Int): Room? {
        return roomRepo.findById(id)
    }

    fun getRoomByName(name: String): Room? {
        return roomRepo.findByName(name)
    }

    fun createRoom(name: String, description: String?, isPrivate: Boolean = false, password: String? = null, creatorId: Int? = null): Room {
        require(name.isNotBlank()) { "Room name is required" }
        if (isPrivate) require(!password.isNullOrBlank()) { "Private rooms require a password" }
        val passwordHash = if (!password.isNullOrBlank()) PasswordUtils.hashPassword(password) else null
        return roomRepo.create(name, description, isPrivate, passwordHash, creatorId)
    }

    fun updateRoom(
        roomId: Int,
        userId: Int,
        name: String,
        description: String?,
        isPrivate: Boolean,
        password: String?
    ): Room? {
        val room = roomRepo.findById(roomId) ?: return null
        if (room.creatorId != userId) return null
        return updateRoomInternal(room, name, description, isPrivate, password)
    }

    fun updateRoom(
        roomId: Int,
        actorUser: User,
        name: String,
        description: String?,
        isPrivate: Boolean,
        password: String?
    ): Room? {
        val room = roomRepo.findById(roomId) ?: return null
        if (!authorizationService.canManageRoom(actorUser, room.creatorId)) return null
        return updateRoomInternal(room, name, description, isPrivate, password)
    }

    private fun updateRoomInternal(
        room: Room,
        name: String,
        description: String?,
        isPrivate: Boolean,
        password: String?
    ): Room? {
        val normalizedName = name.trim()
        require(normalizedName.isNotBlank()) { "Room name is required" }

        val normalizedDescription = description?.trim()?.ifEmpty { null }
        val currentPasswordHash = roomRepo.getPasswordHash(room.id)
        val passwordHash = when {
            !isPrivate -> null
            !password.isNullOrBlank() -> PasswordUtils.hashPassword(password)
            room.isPrivate && !currentPasswordHash.isNullOrBlank() -> currentPasswordHash
            else -> throw IllegalArgumentException("Private rooms require a password")
        }

        roomRepo.update(
            roomId = room.id,
            name = normalizedName,
            description = normalizedDescription,
            isPrivate = isPrivate,
            passwordHash = passwordHash
        )
        return roomRepo.findById(room.id)
    }

    /** Verifies the password for a private room. Returns true if correct or room is public. */
    fun verifyRoomPassword(roomId: Int, password: String?): Boolean {
        val room = roomRepo.findById(roomId) ?: return false
        if (!room.isPrivate) return true
        if (password.isNullOrBlank()) return false
        val storedHash = roomRepo.getPasswordHash(roomId) ?: return false
        return PasswordUtils.verifyPassword(password, storedHash)
    }

    fun deleteRoom(roomId: Int, userId: Int): Boolean {
        val room = roomRepo.findById(roomId) ?: return false
        if (room.creatorId != userId) return false
        roomRepo.delete(roomId)
        return true
    }

    fun deleteRoom(roomId: Int, actorUser: User): Boolean {
        val room = roomRepo.findById(roomId) ?: return false
        if (!authorizationService.canManageRoom(actorUser, room.creatorId)) return false
        roomRepo.delete(roomId)
        return true
    }
}
