package info.signalboost.signalc.testSupport.db

import info.signalboost.signalc.db.Identities
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction


/***
 * UTILITY FOR PRINTING SCHEMA FOR GENERATING MIGRATIONS
 *
 * Usage:
 * - create or edit model code in `db.models`
 * - change `table` to model you just changed
 * - find sql you need in stdout output
 * - add sql to `migrations/changeset.sql`
 * - (including username/millis since epoc / options & teardown in commens)
 * - run `gradle update` (or `make sc.db.migrate`)
 * - use psql shell to make sure it worked! (`make sc.psql`)
 *
 * Prereq:
 * - must have a `signalc_scratch` db in local postgres container
 * - psql -q postgresql://postgres@localhost:5432 -U postgres -c "create database signalc_scratch;"
 ***/

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
