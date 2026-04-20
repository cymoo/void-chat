package util

import io.github.cymoo.colleen.NotFound
import io.github.cymoo.colleen.Unauthorized
import model.User
import service.AuthorizationService
import service.SessionService
import service.UserService

/**
 * Shared authentication/authorization helpers used by controllers.
 */
object AuthHelper {

    /**
     * Validate token → resolve user → check disabled status.
     * Throws [Unauthorized] or [NotFound] on failure.
     */
    fun requireAuthUser(
        token: BearerToken,
        sessionService: SessionService,
        userService: UserService
    ): User {
        val rawToken = token.require()
        val userId = sessionService.validateSession(rawToken)
            ?: throw Unauthorized("Invalid or expired session")
        val user = userService.getUserById(userId)
            ?: throw NotFound("User not found")
        if (user.isDisabled) {
            sessionService.invalidateSession(rawToken)
            throw Unauthorized("Account is disabled")
        }
        return user
    }

    /**
     * Require an authenticated admin user. Combines auth + authorization check.
     */
    fun requireAdmin(
        token: BearerToken,
        sessionService: SessionService,
        userService: UserService,
        authorizationService: AuthorizationService
    ): User {
        val user = requireAuthUser(token, sessionService, userService)
        if (!authorizationService.canAccessAdminDashboard(user)) {
            throw Unauthorized("Admin access required")
        }
        return user
    }
}
