package service

import model.User
import model.UserCapabilities

class AuthorizationService {

    companion object {
        const val ROLE_SUPER_ADMIN = "super_admin"
        const val ROLE_PLATFORM_ADMIN = "platform_admin"
        const val ROLE_USER = "user"

        const val ROOM_ROLE_OWNER = "owner"
        const val ROOM_ROLE_ADMIN = "admin"
        const val ROOM_ROLE_MODERATOR = "moderator"
        const val ROOM_ROLE_MEMBER = "member"
    }

    private val validPlatformRoles = setOf(ROLE_SUPER_ADMIN, ROLE_PLATFORM_ADMIN, ROLE_USER)
    private val validAssignableRoomRoles = setOf(ROOM_ROLE_ADMIN, ROOM_ROLE_MODERATOR, ROOM_ROLE_MEMBER)

    fun normalizePlatformRole(value: String?): String {
        val normalized = value?.trim()?.lowercase()
        return normalized?.takeIf { it in validPlatformRoles } ?: ROLE_USER
    }

    fun normalizeRoomRole(value: String?): String {
        return when (value?.trim()?.lowercase()) {
            ROOM_ROLE_OWNER -> ROOM_ROLE_OWNER
            ROOM_ROLE_ADMIN -> ROOM_ROLE_ADMIN
            ROOM_ROLE_MODERATOR -> ROOM_ROLE_MODERATOR
            else -> ROOM_ROLE_MEMBER
        }
    }

    fun isPlatformAdmin(user: User): Boolean {
        val role = normalizePlatformRole(user.role)
        return role == ROLE_SUPER_ADMIN || role == ROLE_PLATFORM_ADMIN
    }

    fun capabilitiesForPlatformRole(role: String?): UserCapabilities {
        val normalized = normalizePlatformRole(role)
        val canAccessAdmin = normalized == ROLE_SUPER_ADMIN || normalized == ROLE_PLATFORM_ADMIN
        return UserCapabilities(
            canAccessAdminDashboard = canAccessAdmin,
            canManagePlatformUsers = canAccessAdmin
        )
    }

    fun canAccessAdminDashboard(user: User): Boolean = capabilitiesForPlatformRole(user.role).canAccessAdminDashboard

    fun canManagePlatformUsers(user: User): Boolean = capabilitiesForPlatformRole(user.role).canManagePlatformUsers

    fun canAssignPlatformRole(actorUser: User, targetCurrentRole: String?, targetRole: String): Boolean {
        val actorRole = normalizePlatformRole(actorUser.role)
        val currentTargetRole = normalizePlatformRole(targetCurrentRole)
        val desiredRole = targetRole.trim().lowercase()

        if (!isValidPlatformRole(desiredRole)) return false

        return when (actorRole) {
            ROLE_SUPER_ADMIN -> true
            ROLE_PLATFORM_ADMIN -> currentTargetRole != ROLE_SUPER_ADMIN && desiredRole != ROLE_SUPER_ADMIN
            else -> false
        }
    }

    fun canManageRoom(actorUser: User, roomCreatorId: Int?): Boolean {
        return isPlatformAdmin(actorUser) || roomCreatorId == actorUser.id
    }

    fun canDeleteAnyMessage(actorUser: User, actorRoomRole: String?): Boolean {
        if (isPlatformAdmin(actorUser)) return true
        return normalizeRoomRole(actorRoomRole) in setOf(ROOM_ROLE_OWNER, ROOM_ROLE_ADMIN, ROOM_ROLE_MODERATOR)
    }

    fun canManageRoomRoles(actorUser: User, actorRoomRole: String?): Boolean {
        if (isPlatformAdmin(actorUser)) return true
        return normalizeRoomRole(actorRoomRole) in setOf(ROOM_ROLE_OWNER, ROOM_ROLE_ADMIN)
    }

    fun canKickUsers(actorUser: User, actorRoomRole: String?): Boolean {
        if (isPlatformAdmin(actorUser)) return true
        return normalizeRoomRole(actorRoomRole) in setOf(ROOM_ROLE_OWNER, ROOM_ROLE_ADMIN, ROOM_ROLE_MODERATOR)
    }

    fun isValidPlatformRole(role: String): Boolean = role.trim().lowercase() in validPlatformRoles

    fun isValidAssignableRoomRole(role: String): Boolean = role.trim().lowercase() in validAssignableRoomRoles
}
