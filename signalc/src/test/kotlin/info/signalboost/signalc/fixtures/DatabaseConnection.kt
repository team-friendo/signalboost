package info.signalboost.signalc.fixtures

import info.signalboost.signalc.db.*
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.StdOutSqlLogger
import org.jetbrains.exposed.sql.addLogger
import org.jetbrains.exposed.sql.transactions.transaction

object DatabaseConnection {
    fun toH2() = Database.connect(
        url ="jdbc:h2:mem:test;DB_CLOSE_DELAY=-1;",
        driver = "org.h2.Driver",
    )

    fun toPostgres() = Database.connect(
        url = "jdbc:pgsql://localhost:5432/signalc_test",
        driver = "com.impossibl.postgres.jdbc.PGDriver",
        user = "postgres"
    )

    fun Database.initialize(withLogging: Boolean = false): Database =
        transaction(this) {
            if (withLogging) addLogger(StdOutSqlLogger)
            SchemaUtils.create(
                Identities,
                OwnIdentities,
                PreKeys,
                Sessions,
                SignedPreKeys,
            )
            this@initialize
        }

}