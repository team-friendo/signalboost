package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

const val SIGNED_PREKEY_BYTE_ARRAY_LENGTH = 146

object SignedPreKeys: Table() {
    val accountId = varchar("account_id", 255)
    val preKeyId = integer("id")
    val signedPreKeyBytes = binary("signed_prekey_bytes", SIGNED_PREKEY_BYTE_ARRAY_LENGTH)
    override val primaryKey = PrimaryKey(accountId, preKeyId)
}