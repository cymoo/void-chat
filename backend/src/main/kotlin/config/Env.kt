package config

import io.github.cdimascio.dotenv.Dotenv
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Environment configuration loader with profile-based layering.
 *
 * **Load order**: `.env` → `.env.{profile}` → `.env.local`
 *
 * **Priority**: System env > System properties > .env files
 *
 * ```kotlin
 * Env.load()
 * val dbUrl = Env.require("DATABASE_URL")
 * if (Env.isDev) { enableDebugMode() }
 * ```
 *
 * @property profileKey Environment variable for profile name (default: "COLLEEN_ENV")
 * @property defaultProfile Default profile (default: "prod")
 */
class EnvLoader(
    private val profileKey: String = "COLLEEN_ENV",
    private val defaultProfile: String = "prod"
) {
    private val cache = mutableMapOf<String, String>()
    private var loaded = false

    companion object {
        val logger: Logger = LoggerFactory.getLogger(EnvLoader::class.java)
    }

    /**
     * Load environment variables from .env files.
     *
     * Idempotent — safe to call multiple times.
     * Individual file loading failures are logged but don't stop the overall process.
     */
    fun load() {
        if (loaded) return

        val profile = profile()
        logger.info("Active profile: $profile")

        // Load files in order: .env → .env.{profile} → .env.local
        listOf(".env", ".env.$profile", ".env.local").forEach { fileName ->
            File(System.getProperty("user.dir"), fileName)
                .takeIf { it.exists() && it.isFile }
                ?.let { loadFile(it) }
        }

        // Apply loaded values to system properties (if not already set)
        cache.forEach { (k, v) ->
            if (System.getenv(k) == null && System.getProperty(k) == null) {
                System.setProperty(k, v)
            }
        }

        loaded = true
    }

    /**
     * Get environment variable value.
     *
     * Priority: System env > System properties > cache
     */
    operator fun get(key: String): String? =
        System.getenv(key) ?: System.getProperty(key) ?: cache[key]

    /**
     * Get required environment variable.
     *
     * @throws IllegalArgumentException if missing or blank
     */
    fun require(key: String): String {
        val value = get(key)
        require(!value.isNullOrBlank()) { "Missing required variable: $key" }
        return value
    }

    /**
     * Validate multiple required variables.
     *
     * @throws IllegalArgumentException if any missing or blank
     */
    fun requireAll(vararg keys: String) {
        val missing = keys.filter { get(it).isNullOrBlank() }
        require(missing.isEmpty()) { "Missing: ${missing.joinToString()}" }
    }

    /** Check if variable exists (not null and not blank). */
    operator fun contains(key: String): Boolean = !get(key).isNullOrBlank()

    /** Get active profile name. */
    fun profile(): String = get(profileKey)?.takeIf { it.isNotBlank() } ?: defaultProfile

    /** Development profile check. */
    val isDev get() = profile().let { it == "dev" || it == "development" }

    /** Production profile check. */
    val isProd get() = profile().let { it == "prod" || it == "production" }

    /** Test profile check. */
    val isTest get() = profile() == "test"

    /**
     * Load a single .env file into cache.
     *
     * Failures are logged but don't throw.
     */
    private fun loadFile(file: File) {
        try {
            Dotenv.configure()
                .directory(file.parent)
                .filename(file.name)
                .ignoreIfMissing()
                .load()
                .entries()
                .forEach { entry -> cache[entry.key] = entry.value }
        } catch (e: Exception) {
            logger.warn("Failed to load ${file.name}: ${e.message}")
        }
    }
}

/**
 * Global environment configuration instance.
 *
 * ```kotlin
 * Env.load()
 * val apiKey = Env["API_KEY"] ?: "default"
 * if (Env.isDev) { /* ... */ }
 * ```
 */
val Env = EnvLoader()
