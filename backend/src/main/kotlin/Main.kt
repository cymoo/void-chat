import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import config.DatabaseConfig
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
    val dbUrl = "jdbc:sqlite:${projectRoot}/chat.db"
    val dataSource = DatabaseConfig.createDataSource(dbUrl)
    DatabaseConfig.runMigrations(dataSource)
    val dsl = DatabaseConfig.createDSLContext(dataSource)

    // Create ObjectMapper
    val objectMapper = jacksonObjectMapper().apply {
        enable(SerializationFeature.INDENT_OUTPUT)
    }

    // Create services
    val authorizationService = AuthorizationService()
    val userService = UserService(dsl, authorizationService)
    val roomService = RoomService(dsl, authorizationService)
    val chatService = ChatService(dsl, objectMapper)
    val fileService = FileService("${projectRoot}/uploads")
    val sessionService = SessionService()

    // Middleware
    app.use(RequestLogger())
    app.use(Cors.permissive())

    // Controllers
    app.addController(AuthController(userService, sessionService))
    app.addController(ApiController(roomService, fileService, userService, sessionService, chatService, authorizationService))
    app.addController(FileController(fileService))
    app.addController(ChatController(userService, chatService, roomService, sessionService, objectMapper))

    app.listen(8000)
    logger.info("✅ Chat API Server running on http://localhost:8000")
}
