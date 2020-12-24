package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

object Accounts: Table() {
    private const val PROFILE_KEY_BYTE_ARRAY_LENGTH = 33

    val uuid = uuid("uuid").nullable()
    val status = varchar("status", 255)
    val username = varchar("username", 255)
    val password = varchar("password", 255)
    val signalingKey = varchar("signaling_key", 255)
    val profileKey = binary("profile_key_bytes", PROFILE_KEY_BYTE_ARRAY_LENGTH)
    val deviceId = integer("device_id")

    override val primaryKey = PrimaryKey(username)
}
