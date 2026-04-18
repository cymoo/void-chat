package controller

import io.github.cymoo.colleen.*
import model.InvitePersonaRequest
import model.UpdatePersonaRequest
import persona.PersonaChatEngine
import service.AuthorizationService
import service.SessionService
import service.UserService
import util.BearerToken

/**
 * Thin REST controller for persona (digital persona) operations.
 * All business logic lives in [PersonaChatEngine].
 */
@Controller("/api/personas")
class PersonaController(
    private val engine: PersonaChatEngine,
    private val sessionService: SessionService,
    private val userService: UserService,
    private val authorizationService: AuthorizationService
) {

    @Post("/rooms/{roomId}/invite")
    fun invitePersona(roomId: Path<Int>, body: Json<InvitePersonaRequest>, token: BearerToken): Any {
        val actor = requireAuthUser(token)
        val request = body.value
        if (request.name.isBlank()) throw BadRequest("Persona name is required")
        return engine.invitePersona(roomId.value, request.name, request.personality, actor.id)
    }

    @Delete("/rooms/{roomId}/{userId}")
    fun removePersona(roomId: Path<Int>, userId: Path<Int>, token: BearerToken): Any {
        requireAuthUser(token)
        val success = engine.removePersona(roomId.value, userId.value)
        if (!success) throw NotFound("Persona not found in room")
        return mapOf("success" to true)
    }

    @Get("/rooms/{roomId}")
    fun listPersonas(roomId: Path<Int>, token: BearerToken): Any {
        requireAuthUser(token)
        return mapOf("roomId" to roomId.value)
    }

    @Get("/")
    fun listAllPersonas(token: BearerToken): Any {
        val actor = requireAuthUser(token)
        if (!authorizationService.canManagePlatformUsers(actor)) {
            throw Unauthorized("Admin permission required")
        }
        return engine.listAllConfigs().map { config ->
            mapOf(
                "userId" to config.userId,
                "name" to config.name,
                "displayName" to config.displayName,
                "bio" to config.bio,
                "personality" to config.personality,
                "systemPrompt" to config.systemPrompt,
                "invitedBy" to config.invitedBy,
                "createdAt" to config.createdAt
            )
        }
    }

    @Patch("/{userId}")
    fun updatePersona(userId: Path<Int>, body: Json<UpdatePersonaRequest>, token: BearerToken): Any {
        val actor = requireAuthUser(token)
        if (!authorizationService.canManagePlatformUsers(actor)) {
            throw Unauthorized("Admin permission required")
        }
        val req = body.value
        val updated = engine.updateConfig(
            userId = userId.value,
            displayName = req.displayName,
            bio = req.bio,
            systemPrompt = req.systemPrompt,
            personality = req.personality
        ) ?: throw NotFound("Persona not found")
        return mapOf(
            "userId" to updated.userId,
            "name" to updated.name,
            "displayName" to updated.displayName,
            "bio" to updated.bio,
            "personality" to updated.personality,
            "systemPrompt" to updated.systemPrompt,
            "invitedBy" to updated.invitedBy,
            "createdAt" to updated.createdAt
        )
    }

    private fun requireAuthUser(token: BearerToken): model.User {
        val rawToken = token.require()
        val userId = sessionService.validateSession(rawToken) ?: throw Unauthorized("Invalid or expired session")
        val user = userService.getUserById(userId) ?: throw NotFound("User not found")
        if (user.isDisabled) throw Unauthorized("Account is disabled")
        return user
    }
}
