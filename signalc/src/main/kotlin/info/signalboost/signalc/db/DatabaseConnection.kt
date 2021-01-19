package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.StdOutSqlLogger
import org.jetbrains.exposed.sql.addLogger
import org.jetbrains.exposed.sql.transactions.transaction

object DatabaseConnection {
    fun toDev() = Database.connect(
        url = "jdbc:pgsql://localhost:5432/signalc_development",
        driver = "com.impossibl.postgres.jdbc.PGDriver",
        user = "postgres"
    )

    fun Database.initialize(withLogging: Boolean = false): Database =
        transaction(this) {
            if (withLogging) addLogger(StdOutSqlLogger)
            SchemaUtils.create(
                Accounts,
                Identities,
                OwnIdentities,
                PreKeys,
                Sessions,
                SignedPreKeys,
            )
            this@initialize
        }

}