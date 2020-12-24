package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

object PreKeys: Table() {
    private const val PREKEY_BYTE_ARRAY_LENGTH = 71

    val accountId = varchar("account_id", 255)
    val preKeyId = integer("prekey_id")
    val preKeyBytes = binary("prekey_bytes", PREKEY_BYTE_ARRAY_LENGTH)

    override val primaryKey = PrimaryKey(accountId, preKeyId)
}
