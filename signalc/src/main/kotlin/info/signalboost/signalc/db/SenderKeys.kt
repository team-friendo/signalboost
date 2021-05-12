package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

object SenderKeys: Table() {
    val accountId = varchar("account_id", 255)
    val name = varchar("name", 255)
    val deviceId = integer("device_id")
    val distributionId = uuid("distribution_id")
    val senderKeyBytes = binary("identity_key_bytes")

    override val primaryKey = PrimaryKey(accountId, name, deviceId, distributionId)
}