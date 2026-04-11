package controller

import io.github.cymoo.colleen.*
import model.AuthResponse
import model.LoginRequest
import model.RegistrationModeResponse
import model.RegisterRequest
import model.User
import service.InvitationService
import service.SessionService
import service.UserService
import util.BearerToken

/**
 * Authentication controller: register, login, logout, current user
 */
@Controller("/api/auth")
class AuthController(
    private val userService: UserService,
    private val sessionService: SessionService,
    private val invitationService: InvitationService
) {

    @Post("/register")
    fun register(body: Json<RegisterRequest>): AuthResponse {
        val req = body.value
        if (req.username.isBlank()) throw BadRequest("Username is required")
        if (req.password.length < 6) throw BadRequest("Password must be at least 6 characters")

        return try {
            invitationService.validateAndConsumeRegistrationInvite(req.inviteCode)
            val result = userService.register(req.username, req.password)
            val token = sessionService.createSession(result.user.id)
            AuthResponse(token = token, user = result.user)
        } catch (e: IllegalArgumentException) {
            throw BadRequest(e.message ?: "Registration failed")
        }
    }

    @Post("/login")
    fun login(body: Json<LoginRequest>): AuthResponse {
        val req = body.value
        val user = userService.login(req.username, req.password)
            ?: throw Unauthorized("Invalid username or password")
        val token = sessionService.createSession(user.id)
        return AuthResponse(token = token, user = user)
    }

    @Post("/logout")
    fun logout(ctx: Context, token: BearerToken) {
        token.getOrNull()?.let { sessionService.invalidateSession(it) }
        ctx.status(204)
    }

    @Get("/me")
    fun me(token: BearerToken): User {
        val rawToken = token.require()
        val userId = sessionService.validateSession(rawToken) ?: throw Unauthorized("Invalid or expired session")
        val user = userService.getUserById(userId) ?: throw NotFound("User not found")
        if (user.isDisabled) {
            sessionService.invalidateSession(rawToken)
            throw Unauthorized("Account is disabled")
        }
        return user
    }

    @Get("/registration-mode")
    fun registrationMode(): RegistrationModeResponse {
        return RegistrationModeResponse(mode = invitationService.getRegistrationMode())
    }
}
