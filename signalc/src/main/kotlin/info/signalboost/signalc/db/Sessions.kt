package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table



object Sessions: Table(), AccountWithAddress  {
    private const val SESSION_BYTE_ARRAY_LENGTH = 32

    override val accountId = varchar("account_id", 255)
    override val name = varchar("name", 255)
    override val deviceId = integer("device_id")
    val sessionBytes = binary("session_bytes", SESSION_BYTE_ARRAY_LENGTH)

    override val primaryKey = PrimaryKey(accountId, name, deviceId)
}