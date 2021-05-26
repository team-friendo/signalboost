package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

object OwnProfiles: Table() {
    val accountId = varchar("account_id", 255)
    val profileKeyBytes = binary("profile_key_bytes")

    override val primaryKey = PrimaryKey(accountId)
}