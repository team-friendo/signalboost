package info.signalboost.signalc.db

import org.jetbrains.exposed.dao.id.UUIDTable
import org.jetbrains.exposed.sql.Table

object Envelopes: UUIDTable() {
    val accountId = varchar("account_id", 255)
    val envelopeBytes = binary("envelope_bytes")
    val serverDeliveredTimestamp = long("server_delivered_timestamp")
}
