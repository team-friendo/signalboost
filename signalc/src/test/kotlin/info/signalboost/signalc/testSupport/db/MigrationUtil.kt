package info.signalboost.signalc.testSupport.db

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

object MigrationUtil {
    fun Database.genMigrationFor(table: Table) {
        transaction(this) {
            addLogger(StdOutSqlLogger)
            SchemaUtils.create(table)
        }
    }
}