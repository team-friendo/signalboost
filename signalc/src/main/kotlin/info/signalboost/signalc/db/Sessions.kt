package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table



object Sessions: Table(), ContactRecord, DeviceRecord  {
    override val accountId = varchar("account_id", 255)
    override val contactId = varchar("contact_id", 255)
    override val deviceId = integer("device_id")
    val sessionBytes = binary("session_bytes")

    override val primaryKey = PrimaryKey(accountId, contactId, deviceId)
}