package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

object Accounts: Table() {
    val accountId = varchar("account_id", 255)

    override val primaryKey = PrimaryKey(accountId)
}
