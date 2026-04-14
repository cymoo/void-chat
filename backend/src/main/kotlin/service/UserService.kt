package service

import model.AuthResponse
import model.User
import org.jooq.DSLContext
import repository.UserRepository
import java.time.OffsetDateTime
import java.time.ZoneOffset
import util.PasswordUtils

/**
 * User lifecycle service: registration, login, profile management, and admin operations.
 */
class UserService(
    private val dsl: DSLContext,
    private val authorizationService: AuthorizationService = AuthorizationService()
) {

    private val userRepo = UserRepository(dsl)

    /**
     * Register a new user or claim a legacy (passwordless) account.
     * The first registered user is auto-promoted to super_admin when none exists.
     * Wrapped in a transaction for atomicity.
     */
    fun register(username: String, password: String): AuthResponse {
        require(username.isNotBlank()) { "Username is required" }
        require(password.length >= 6) { "Password must be at least 6 characters" }

        return dsl.transactionResult { cfg ->
            val txRepo = UserRepository(cfg.dsl())
            val existing = txRepo.findByUsernameForAuth(username)
            val passwordHash = PasswordUtils.hashPassword(password)

            var user = if (existing != null) {
                require(existing.passwordHash == null) { "Username already taken" }
                require(!existing.user.isDisabled) { "Account is disabled" }
                txRepo.setPasswordHash(existing.user.id, passwordHash)
                existing.user
            } else {
                txRepo.createUser(username, passwordHash)
            }

            // Bootstrap: first registered user becomes super_admin if none exists
            if (txRepo.countByRole(AuthorizationService.ROLE_SUPER_ADMIN) == 0) {
                txRepo.updateRole(user.id, AuthorizationService.ROLE_SUPER_ADMIN)
                user = txRepo.findById(user.id) ?: user.copy(role = AuthorizationService.ROLE_SUPER_ADMIN)
            }

            AuthResponse(token = "", user = user)
        }
    }

    fun login(username: String, password: String): User? {
        val authUser = userRepo.findByUsernameForAuth(username) ?: return null
        if (authUser.user.isDisabled) return null
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
        if (!AuthorizationService.isValidPlatformRole(desiredRole)) {
            throw IllegalArgumentException("Invalid platform role")
        }

        if (!authorizationService.canManagePlatformUsers(actorUser)) {
            throw IllegalArgumentException("Insufficient permission to manage user roles")
        }

        if (actorUser.id == targetUserId) {
            throw IllegalArgumentException("Cannot change your own role")
        }

        val targetUser = userRepo.findById(targetUserId) ?: return null
        val targetCurrentRole = AuthorizationService.normalizePlatformRole(targetUser.role)

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

    fun updateUserDisabled(actorUser: User, targetUserId: Int, disabled: Boolean, reason: String?): User? {
        if (!authorizationService.canManagePlatformUsers(actorUser)) {
            throw IllegalArgumentException("Insufficient permission to manage users")
        }
        if (actorUser.id == targetUserId) {
            throw IllegalArgumentException("Cannot change your own account status")
        }

        val targetUser = userRepo.findById(targetUserId) ?: return null
        if (!authorizationService.canModeratePlatformUser(actorUser, targetUser.role)) {
            throw IllegalArgumentException("Target user is protected")
        }

        val targetRole = AuthorizationService.normalizePlatformRole(targetUser.role)
        if (disabled && targetRole == AuthorizationService.ROLE_SUPER_ADMIN &&
            userRepo.countActiveByRole(AuthorizationService.ROLE_SUPER_ADMIN) <= 1
        ) {
            throw IllegalArgumentException("At least one active super admin must remain")
        }

        val normalizedReason = reason?.trim()?.ifEmpty { null }
        if (!userRepo.updateDisabled(targetUserId, disabled, if (disabled) normalizedReason else null)) {
            return null
        }
        return userRepo.findById(targetUserId)
    }

    fun updateUserMute(
        actorUser: User,
        targetUserId: Int,
        muted: Boolean,
        durationMinutes: Int?,
        reason: String?
    ): User? {
        if (!authorizationService.canManagePlatformUsers(actorUser)) {
            throw IllegalArgumentException("Insufficient permission to manage users")
        }
        if (actorUser.id == targetUserId) {
            throw IllegalArgumentException("Cannot change your own account status")
        }

        val targetUser = userRepo.findById(targetUserId) ?: return null
        if (!authorizationService.canModeratePlatformUser(actorUser, targetUser.role)) {
            throw IllegalArgumentException("Target user is protected")
        }

        val normalizedReason = reason?.trim()?.ifEmpty { null }
        val mutedUntil = if (muted) {
            val minutes = durationMinutes ?: 60
            require(minutes in 1..(7 * 24 * 60)) { "Mute duration must be between 1 and 10080 minutes" }
            OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(minutes.toLong())
        } else {
            null
        }

        if (!userRepo.updateMute(targetUserId, mutedUntil, if (muted) normalizedReason else null)) {
            return null
        }
        return userRepo.findById(targetUserId)
    }

    fun updateProfile(
        userId: Int,
        username: String?,
        avatarUrl: String?,
        bio: String?,
        status: String?
    ): User? {
        val currentUser = userRepo.findById(userId) ?: return null
        val normalizedUsername = username?.trim()?.also {
            require(it.isNotEmpty()) { "Username is required" }
        }

        if (normalizedUsername != null && normalizedUsername != currentUser.username) {
            val existing = userRepo.findByUsernameForAuth(normalizedUsername)
            if (existing != null && existing.user.id != userId) {
                throw IllegalArgumentException("Username already taken")
            }
        }

        userRepo.updateProfile(userId, normalizedUsername, avatarUrl, bio, status)
        return userRepo.findById(userId)
    }

    /**
     * Ensure the given user exists as super_admin.
     * Used for INIT_ADMIN bootstrapping at startup.
     */
    fun ensureAdmin(username: String, password: String) {
        val existing = userRepo.findByUsernameForAuth(username)
        val passwordHash = PasswordUtils.hashPassword(password)
        val user = if (existing != null) {
            userRepo.setPasswordHash(existing.user.id, passwordHash)
            existing.user
        } else {
            userRepo.createUser(username, passwordHash)
        }
        userRepo.updateRole(user.id, AuthorizationService.ROLE_SUPER_ADMIN)
    }
}
