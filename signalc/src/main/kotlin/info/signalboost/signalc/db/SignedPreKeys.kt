package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

object SignedPreKeys: Table() {
    private const val SIGNED_PREKEY_BYTE_ARRAY_LENGTH = 146

    val accountId = varchar("account_id", 255)
    val preKeyId = integer("id")
    val signedPreKeyBytes = binary("signed_prekey_bytes", SIGNED_PREKEY_BYTE_ARRAY_LENGTH)

    override val primaryKey = PrimaryKey(accountId, preKeyId)
}