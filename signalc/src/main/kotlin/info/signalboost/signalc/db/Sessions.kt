package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

const val SESSION_BYTE_ARRAY_LENGTH = 32

object Sessions: Table(), AccountWithAddress  {
    override val accountId = varchar("account_id", 255)
    override val name = varchar("name", 255)
    override val deviceId = integer("device_id")
    val sessionBytes = binary("session_bytes", SESSION_BYTE_ARRAY_LENGTH)
    override val primaryKey = PrimaryKey(accountId, name, deviceId)
}