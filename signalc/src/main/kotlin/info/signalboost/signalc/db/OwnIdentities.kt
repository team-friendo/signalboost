package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table


const val IDENTITY_KEYPAIR_BYTE_ARRAY_LENGTH = 69

object OwnIdentities: Table() {
    val accountId = varchar("account_id", 255)
    val keyPairBytes = binary("keypair_bytes", IDENTITY_KEYPAIR_BYTE_ARRAY_LENGTH)
    val registrationId = integer("registration_id")
    override val primaryKey = PrimaryKey(accountId)
}