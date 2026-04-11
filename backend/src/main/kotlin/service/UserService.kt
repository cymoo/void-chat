package service

import model.AuthResponse
import model.User
import org.jooq.DSLContext
import repository.UserRepository
import util.PasswordUtils

/**
 * User service with registration and login support
 */
class UserService(
    dsl: DSLContext,
    private val authorizationService: AuthorizationService = AuthorizationService()
) {

    private val userRepo = UserRepository(dsl)

    fun register(username: String, password: String): AuthResponse {
        require(username.isNotBlank()) { "Username is required" }
        require(password.length >= 6) { "Password must be at least 6 characters" }

        val existing = userRepo.findByUsernameForAuth(username)
        val passwordHash = PasswordUtils.hashPassword(password)

        var user = if (existing != null) {
            // Legacy account (no password) can claim ownership by registering
            require(existing.passwordHash == null) { "Username already taken" }
            userRepo.setPasswordHash(existing.user.id, passwordHash)
            existing.user
        } else {
            userRepo.createUser(username, passwordHash)
        }

        // Bootstrap rule: if there is no super admin yet, first registered account becomes super admin.
        if (userRepo.countByRole(AuthorizationService.ROLE_SUPER_ADMIN) == 0) {
            userRepo.updateRole(user.id, AuthorizationService.ROLE_SUPER_ADMIN)
            user = userRepo.findById(user.id) ?: user.copy(role = AuthorizationService.ROLE_SUPER_ADMIN)
        }

        return AuthResponse(token = "", user = user)
    }

    fun login(username: String, password: String): User? {
        val authUser = userRepo.findByUsernameForAuth(username) ?: return null
        if (authUser.passwordHash == null) return null // unregistered legacy account
        if (!PasswordUtils.verifyPassword(password, authUser.passwordHash)) return null
        userRepo.updateLastSeen(authUser.user.id)
        return userRepo.findById(authUser.user.id) ?: authUser.user
    }

    /** Finds or creates a guest user (no password). Used for legacy/system purposes. */
    fun findOrCreateUser(username: String): User {
        return userRepo.findByUsername(username)
            ?: userRepo.createUser(username)
    }

    fun getUserById(id: Int): User? {
        return userRepo.findById(id)
    }

    fun getUserByUsername(username: String): User? {
        return userRepo.findByUsername(username)
    }

    fun listUsers(): List<User> {
        return userRepo.listUsers()
    }

    fun updateUserRole(actorUser: User, targetUserId: Int, role: String): User? {
        val desiredRole = role.trim().lowercase()
        if (!authorizationService.isValidPlatformRole(desiredRole)) {
            throw IllegalArgumentException("Invalid platform role")
        }

        if (!authorizationService.canManagePlatformUsers(actorUser)) {
            throw IllegalArgumentException("Insufficient permission to manage user roles")
        }

        if (actorUser.id == targetUserId) {
            throw IllegalArgumentException("Cannot change your own role")
        }

        val targetUser = userRepo.findById(targetUserId) ?: return null
        val targetCurrentRole = authorizationService.normalizePlatformRole(targetUser.role)

        if (!authorizationService.canAssignPlatformRole(actorUser, targetCurrentRole, desiredRole)) {
            throw IllegalArgumentException("Role assignment is not allowed")
        }

        val demotingSuperAdmin = targetCurrentRole == AuthorizationService.ROLE_SUPER_ADMIN &&
            desiredRole != AuthorizationService.ROLE_SUPER_ADMIN
        if (demotingSuperAdmin && userRepo.countByRole(AuthorizationService.ROLE_SUPER_ADMIN) <= 1) {
            throw IllegalArgumentException("At least one super admin must remain")
        }

        if (!userRepo.updateRole(targetUserId, desiredRole)) return null
        return userRepo.findById(targetUserId)
    }

    fun updateProfile(userId: Int, avatarUrl: String?, bio: String?, status: String?): User? {
        userRepo.updateProfile(userId, avatarUrl, bio, status)
        return userRepo.findById(userId)
    }
}
