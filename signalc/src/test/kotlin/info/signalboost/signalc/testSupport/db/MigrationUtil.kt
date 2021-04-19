package info.signalboost.signalc.testSupport.db

import info.signalboost.signalc.db.Identities
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction


/***********************************************************
 * UTILITY TO PRINT DB SCHEMA FOR USE IN LIQUIBASE MIGRATIONS
 *
 * Usage:
 * - create or edit model code in `db.models`
 *   - consult docs for DSL: https://github.com/JetBrains/Exposed/wiki/DSL
 * - change `table` below to match classname of model you just changed
 * - run this file in intellij, find sql you need in `Run` window output
 * - add sql to `migrations/changelog.postgresql.sql`
 * - also add appropriate comments in metadata:
 *   - prefix comment to include in line above each sql statement you want to consider a "change:
 *     `-- changeset <username><millis-since-epoch><nth-migration-run-at-that-time> failOnError:fase`
 *   - postfix comment to include in line below each change:
 *     `-- rollback <sql to execute to rollback the sql below prefix comment>`
 * - run `gradle update` (or `make sc.db.migrate`)
 * - use psql shell to make sure it worked! (`make sc.db.psql`)
 *
 * Prereq:
 * - must have a `signalc_scratch` db in local postgres container
 * - psql -q postgresql://postgres@localhost:5432 -U postgres -c "create database signalc_scratch;"
 ************************************************************/

fun main() {
    // change this assignment to
    val table = Identities
    val db = Database.connect(
        driver = "com.impossibl.postgres.jdbc.PGDriver",
        url = "jdbc:pgsql://localhost:5432/signalc_scratch",
        user= "postgres",
    )

    transaction(db) {
        addLogger(StdOutSqlLogger)
        SchemaUtils.create(table)
    }
}
