import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import config.DatabaseConfig
import config.RedisConfig
import controller.ApiController
import controller.AuthController
import controller.ChatController
import controller.FileController
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
import java.nio.file.Paths

val logger: Logger = LoggerFactory.getLogger("App")

fun main() {
    val app = Colleen()
    app.openApi()

    app.config {
        // Configure server
        server {
            maxRequestSize = 30 * 1024 * 1024  // 30MB for file uploads
        }
        // Configure WebSocket
        ws {
            idleTimeoutMs = 600_000            // 10 minutes
            maxMessageSizeBytes = 256 * 1024   // 256 KB
            pingIntervalMs = 30_000            // 30 seconds
            pingTimeoutMs = 10_000             // 10 seconds
            maxConnections = 500               // Max 500 connections
        }
    }

    // Resolve project root (parent of backend/)
    val projectRoot = Paths.get(System.getProperty("user.dir")).parent?.toString()
        ?: System.getProperty("user.dir")

    // Setup database
    val dbUrl = System.getenv("DATABASE_URL") ?: "jdbc:postgresql://localhost:5432/void_chat"
    val dbUser = System.getenv("DATABASE_USER") ?: "postgres"
    val dbPassword = System.getenv("DATABASE_PASSWORD") ?: "postgres"
    val dataSource = DatabaseConfig.createDataSource(dbUrl, dbUser, dbPassword)
    DatabaseConfig.runMigrations(dataSource)
    val dsl = DatabaseConfig.createDSLContext(dataSource)

    // Setup Redis
    val redisUrl = System.getenv("REDIS_URL") ?: "redis://localhost:6379"
    val jedisPool = RedisConfig.createPool(redisUrl)

    // Create ObjectMapper
    val objectMapper = jacksonObjectMapper()

    // Create services
    val authorizationService = AuthorizationService()
    val invitationService = InvitationService(dsl)
    val userService = UserService(dsl, authorizationService)
    val roomService = RoomService(dsl, authorizationService)
    val chatService = ChatService(dsl, objectMapper, jedisPool)
    val fileService = FileService("${projectRoot}/uploads")
    val sessionService = SessionService(jedisPool)

    // Middleware
    app.use(RequestLogger())
    app.use(Cors.permissive())

    // Controllers
    app.addController(AuthController(userService, sessionService, invitationService))
    app.addController(ApiController(roomService, fileService, userService, invitationService, sessionService, chatService, authorizationService))
    app.addController(FileController(fileService))
    app.addController(ChatController(userService, chatService, roomService, sessionService, objectMapper))

    // Start Redis pub/sub subscriber for cross-instance messaging
    chatService.startRedisSubscriber()

    app.listen(8000)
    logger.info("✅ Chat API Server running on http://localhost:8000")
}
