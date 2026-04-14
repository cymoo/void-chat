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

    companion object {
        private const val DEFAULT_MAX_USERS = 100
        private const val MIN_MAX_USERS = 1
        private const val MAX_MAX_USERS = 1000
    }

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

    fun createRoom(
        name: String,
        description: String?,
        isPrivate: Boolean = false,
        password: String? = null,
        creatorId: Int? = null,
        maxUsers: Int? = null
    ): Room {
        require(name.isNotBlank()) { "Room name is required" }
        if (isPrivate) require(!password.isNullOrBlank()) { "Private rooms require a password" }
        val passwordHash = if (!password.isNullOrBlank()) PasswordUtils.hashPassword(password) else null
        val normalizedMaxUsers = normalizeMaxUsers(maxUsers, DEFAULT_MAX_USERS)
        return roomRepo.create(name, description, isPrivate, passwordHash, creatorId, normalizedMaxUsers)
    }

    fun updateRoom(
        roomId: Int,
        actorUser: User,
        name: String,
        description: String?,
        isPrivate: Boolean,
        password: String?,
        maxUsers: Int? = null
    ): Room? {
        val room = roomRepo.findById(roomId) ?: return null
        if (!authorizationService.canManageRoom(actorUser, room.creatorId)) return null
        return updateRoomInternal(room, name, description, isPrivate, password, maxUsers)
    }

    private fun updateRoomInternal(
        room: Room,
        name: String,
        description: String?,
        isPrivate: Boolean,
        password: String?,
        maxUsers: Int?
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

        val normalizedMaxUsers = normalizeMaxUsers(maxUsers, room.maxUsers)

        roomRepo.update(
            roomId = room.id,
            name = normalizedName,
            description = normalizedDescription,
            isPrivate = isPrivate,
            passwordHash = passwordHash,
            maxUsers = normalizedMaxUsers
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

    fun deleteRoom(roomId: Int, actorUser: User): Boolean {
        val room = roomRepo.findById(roomId) ?: return false
        if (!authorizationService.canManageRoom(actorUser, room.creatorId)) return false
        roomRepo.delete(roomId)
        return true
    }

    private fun normalizeMaxUsers(value: Int?, fallback: Int): Int {
        val resolved = value ?: fallback
        require(resolved in MIN_MAX_USERS..MAX_MAX_USERS) {
            "Room capacity must be between $MIN_MAX_USERS and $MAX_MAX_USERS"
        }
        return resolved
    }
}
