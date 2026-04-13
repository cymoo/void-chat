package config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.flywaydb.core.Flyway
import org.jooq.DSLContext
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import javax.sql.DataSource

object DatabaseConfig {

    fun createDataSource(dbUrl: String, dbUser: String, dbPassword: String): DataSource {
        val config = HikariConfig().apply {
            jdbcUrl = dbUrl
            username = dbUser
            password = dbPassword
            driverClassName = "org.postgresql.Driver"
            maximumPoolSize = 10
            minimumIdle = 2
            isAutoCommit = true
            connectionInitSql = "SET TIME ZONE 'UTC'"
        }
        return HikariDataSource(config)
    }

    fun runMigrations(dataSource: DataSource, clean: Boolean = false) {
        val flyway = Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .cleanDisabled(!clean)
            .load()

        if (clean) flyway.clean()
        flyway.migrate()
    }

    fun createDSLContext(dataSource: DataSource): DSLContext {
        return DSL.using(dataSource, SQLDialect.POSTGRES)
    }
}
