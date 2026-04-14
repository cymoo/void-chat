import config.DatabaseConfig
import config.Env
import org.jooq.DSLContext
import javax.sql.DataSource

/**
 * Shared test database helper. Uses a dedicated test database (void_chat_test)
 * so that tests never touch production data. Resets state between tests via
 * TRUNCATE + re-seeding.
 *
 * Connection params can be overridden via env vars (TEST_DATABASE_URL, etc.).
 */
object TestDatabase {

    private val dataSource: DataSource by lazy {
        Env.load()
        val url = Env["TEST_DATABASE_URL"] ?: "jdbc:postgresql://localhost:5432/void_chat_test"
        val user = Env["TEST_DATABASE_USER"] ?: Env["DATABASE_USER"] ?: "postgres"
        val password = Env["TEST_DATABASE_PASSWORD"] ?: Env["DATABASE_PASSWORD"] ?: "postgres"
        val ds = DatabaseConfig.createDataSource(url, user, password)
        DatabaseConfig.runMigrations(ds, clean = true)
        ds
    }

    /**
     * Returns a DSLContext backed by the shared pool, with all tables
     * truncated and seed data re-inserted for a clean test run.
     */
    fun createDsl(): DSLContext {
        val dsl = DatabaseConfig.createDSLContext(dataSource)
        resetData(dsl)
        return dsl
    }

    private fun resetData(dsl: DSLContext) {
        dsl.execute("TRUNCATE rooms, messages, room_members, users, private_messages, system_settings, invite_links RESTART IDENTITY CASCADE")
        dsl.execute("""
            INSERT INTO rooms (name, description) VALUES
                ('general', 'General discussion'),
                ('random', 'Random topics'),
                ('tech', 'Tech talk')
        """.trimIndent())
        dsl.execute("""
            INSERT INTO system_settings (key, value) VALUES ('registration_mode', 'open')
        """.trimIndent())
    }
}
