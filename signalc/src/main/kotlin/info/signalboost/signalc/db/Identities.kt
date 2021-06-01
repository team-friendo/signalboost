package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

object Identities: Table(), DeviceRecord {
    private const val IDENTITY_KEY_BYTE_ARRAY_LENGTH = 33

    override val accountId = varchar("account_id", 255)
    override val contactId = varchar("contact_id", 255)
    override val deviceId = integer("device_id")
    val identityKeyBytes = binary("identity_key_bytes", IDENTITY_KEY_BYTE_ARRAY_LENGTH).index()
    val isTrusted = bool("is_trusted").default(true)

    override val primaryKey = PrimaryKey(accountId, contactId, deviceId)

    init {
        // compound index on accountId + contactId
        index(false, accountId, contactId)
    }
}