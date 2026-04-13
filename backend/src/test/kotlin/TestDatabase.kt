import config.DatabaseConfig
import org.jooq.DSLContext
import org.jooq.impl.DSL
import javax.sql.DataSource

/**
 * Shared test database helper. Uses a single connection pool and resets
 * data between tests via TRUNCATE + re-seeding.
 */
object TestDatabase {
    private const val TEST_DB_URL = "jdbc:postgresql://localhost:5432/void_chat"
    private const val TEST_DB_USER = "postgres"
    private const val TEST_DB_PASSWORD = "postgres"

    private val dataSource: DataSource by lazy {
        val ds = DatabaseConfig.createDataSource(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)
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
        // Re-insert seed data matching V1 migration
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
