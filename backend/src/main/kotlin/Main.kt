import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import config.DatabaseConfig
import config.Env
import config.RedisConfig
import controller.ApiController
import controller.AuthController
import controller.ChatController
import controller.FileController
import controller.PersonaController
import io.github.cymoo.colleen.Colleen
import io.github.cymoo.colleen.middleware.Cors
import io.github.cymoo.colleen.middleware.RequestLogger
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import service.ChatService
import service.FileService
import service.RoomService
import service.SessionService
import service.UserService
import service.AuthorizationService
import service.InvitationService
import persona.PersonaChatEngine
import repository.RoomMemberRepository
import repository.UserRepository
import java.nio.file.Paths

val logger: Logger = LoggerFactory.getLogger("App")

fun main() {
    Env.load()

    val app = Colleen()
    app.openApi()

    app.config {
        server {
            maxRequestSize = Env["MAX_REQUEST_SIZE"]?.toLongOrNull() ?: (30L * 1024 * 1024)
        }
        ws {
            idleTimeoutMs = Env["WS_IDLE_TIMEOUT_MS"]?.toLongOrNull() ?: 600_000
            maxMessageSizeBytes = Env["WS_MAX_MESSAGE_SIZE"]?.toLongOrNull() ?: (256L * 1024)
            pingIntervalMs = Env["WS_PING_INTERVAL_MS"]?.toLongOrNull() ?: 30_000
            pingTimeoutMs = Env["WS_PING_TIMEOUT_MS"]?.toLongOrNull() ?: 10_000
            maxConnections = Env["WS_MAX_CONNECTIONS"]?.toIntOrNull() ?: 500
        }
    }

    // Resolve upload directory (default: <project-root>/uploads)
    val projectRoot = Paths.get(System.getProperty("user.dir")).parent?.toString()
        ?: System.getProperty("user.dir")
    val uploadDir = Env["UPLOAD_DIR"] ?: "${projectRoot}/uploads"

    // Database
    val dbUrl = Env["DATABASE_URL"] ?: "jdbc:postgresql://localhost:5432/void_chat"
    val dbUser = Env["DATABASE_USER"] ?: "postgres"
    val dbPassword = Env["DATABASE_PASSWORD"] ?: "postgres"
    val dataSource = DatabaseConfig.createDataSource(dbUrl, dbUser, dbPassword)
    DatabaseConfig.runMigrations(dataSource)
    val dsl = DatabaseConfig.createDSLContext(dataSource)

    // Redis
    val redisUrl = Env["REDIS_URL"] ?: "redis://localhost:6379"
    val jedisPool = RedisConfig.createPool(redisUrl)

    val objectMapper = jacksonObjectMapper()

    // Services
    val maxImageSize = Env["MAX_IMAGE_SIZE"]?.toLongOrNull() ?: (5L * 1024 * 1024)
    val maxFileSize = Env["MAX_FILE_SIZE"]?.toLongOrNull() ?: (20L * 1024 * 1024)
    val sessionTtlDays = Env["SESSION_TTL_DAYS"]?.toLongOrNull() ?: 7L

    val authorizationService = AuthorizationService()
    val invitationService = InvitationService(dsl)
    val userService = UserService(dsl, authorizationService)
    val roomService = RoomService(dsl, authorizationService)
    val chatService = ChatService(dsl, objectMapper, jedisPool)
    val fileService = FileService(uploadDir, maxImageSize, maxFileSize)
    val sessionService = SessionService(jedisPool, sessionTtlDays)

    // Bootstrap initial admin from environment (optional)
    bootstrapInitAdmin(userService)

    // Persona engine (enabled when PERSONA_LLM_API_KEY is set)
    val personaChatEngine: PersonaChatEngine? = if (!Env["PERSONA_LLM_API_KEY"].isNullOrBlank()) {
        val userRepo = UserRepository(dsl)
        val roomMemberRepo = RoomMemberRepository(dsl)
        val engine = PersonaChatEngine(
            bridge = object : PersonaChatEngine.Bridge {
                override fun getRecentMessages(roomId: Int, limit: Int): List<PersonaChatEngine.ContextMessage> {
                    return chatService.getRecentMessages(roomId, limit).mapNotNull { msg ->
                        when (msg) {
                            is model.ChatMessage.Text -> PersonaChatEngine.ContextMessage(
                                msg.userId, msg.username, msg.content, msg.id, msg.replyTo?.id
                            )
                            else -> null
                        }
                    }
                }

                override fun sendBotMessage(roomId: Int, botUserId: Int, content: String, replyToId: Int?) {
                    val botUser = userRepo.findById(botUserId) ?: return
                    chatService.sendTextMessage(roomId, botUser, content, replyToId)
                }

                override fun getOrCreateBotUser(username: String): PersonaChatEngine.BotIdentity {
                    val existing = userRepo.findByUsername(username)
                    if (existing != null) return PersonaChatEngine.BotIdentity(existing.id, existing.username)
                    val created = userRepo.createUser(username)
                    return PersonaChatEngine.BotIdentity(created.id, created.username)
                }

                override fun addBotToRoom(roomId: Int, userId: Int) {
                    roomMemberRepo.addMember(roomId, userId, "member")
                }

                override fun removeBotFromRoom(roomId: Int, userId: Int) {
                    roomMemberRepo.removeMember(roomId, userId)
                }

                override fun broadcastRoomUsers(roomId: Int) {
                    chatService.broadcastToRoom(roomId, model.WsEvent.Users(chatService.getRoomUsers(roomId)))
                }

                override fun sendTypingStatus(roomId: Int, userId: Int, username: String, isTyping: Boolean) {
                    chatService.broadcastToRoom(roomId, model.WsEvent.Typing(userId, username, isTyping))
                }
            },
            jedisPool = jedisPool,
            executor = java.util.concurrent.Executors.newFixedThreadPool(4) { runnable ->
                Thread(runnable).apply {
                    isDaemon = true
                    name = "persona-engine"
                }
            }
        )
        chatService.personaChatEngine = engine
        logger.info("✅ Persona engine enabled (model: ${Env["PERSONA_LLM_MODEL"] ?: "gpt-4"})")
        engine
    } else {
        logger.info("ℹ️ Persona engine disabled (PERSONA_LLM_API_KEY not set)")
        null
    }

    // Middleware
    app.use(RequestLogger())
    app.use(Cors.permissive())

    // Controllers
    app.addController(AuthController(userService, sessionService, invitationService))
    app.addController(ApiController(roomService, fileService, userService, invitationService, sessionService, chatService, authorizationService))
    app.addController(FileController(fileService))
    app.addController(ChatController(userService, chatService, roomService, sessionService, objectMapper))
    if (personaChatEngine != null) {
        app.addController(PersonaController(personaChatEngine, sessionService, userService))
    }

    // Start Redis pub/sub subscriber for cross-instance messaging
    chatService.startRedisSubscriber()

    val port = Env["SERVER_PORT"]?.toIntOrNull() ?: 8000
    app.listen(port)
    logger.info("✅ Chat API Server running on http://localhost:$port")
}

/**
 * If INIT_ADMIN_USERNAME and INIT_ADMIN_PASSWORD are set, ensure the user
 * exists and is promoted to super_admin. Runs once at startup.
 */
private fun bootstrapInitAdmin(userService: UserService) {
    val username = Env["INIT_ADMIN_USERNAME"]?.takeIf { it.isNotBlank() } ?: return
    val password = Env["INIT_ADMIN_PASSWORD"]?.takeIf { it.isNotBlank() } ?: return
    try {
        userService.ensureAdmin(username, password)
        logger.info("Initial admin '$username' bootstrapped from env")
    } catch (e: Exception) {
        logger.warn("Failed to bootstrap initial admin: ${e.message}")
    }
}
