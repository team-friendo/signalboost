package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

object Identities: Table(), AccountWithAddress {
    private const val IDENTITY_KEY_BYTE_ARRAY_LENGTH = 33

    override val accountId = varchar("account_id", 255)
    override val name = varchar("name", 255)
    override val deviceId = integer("device_id")
    val identityKeyBytes = binary("identity_key_bytes", IDENTITY_KEY_BYTE_ARRAY_LENGTH).index()
    val isTrusted = bool("is_trusted").default(true)

    override val primaryKey = PrimaryKey(accountId, name, deviceId)

    init {
        // compound index on accountId + name
        index(false, accountId, name)
    }
}