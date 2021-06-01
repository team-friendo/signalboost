package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.statements.UpdateStatement
import org.whispersystems.libsignal.SignalProtocolAddress

interface DeviceRecord: FieldSet {
    val accountId: Column<String>
    val contactId: Column<String>
    val deviceId: Column<Int>

    companion object {

        fun DeviceRecord.findByAddress(accountId: String, address: SignalProtocolAddress): ResultRow? {
            val table = this
            return table.select {
                (table.accountId eq accountId)
                    .and(table.contactId eq address.name)
                    .and(table.deviceId eq address.deviceId)
            }.singleOrNull()
        }

        fun DeviceRecord.updateByAddress(
            accountId: String,
            address: SignalProtocolAddress,
            updateStatement: Table.(UpdateStatement) -> Unit
        ): Int {
            val table = this
            return (table as Table).update ({
                (table.accountId eq accountId)
                    .and(table.contactId eq address.name)
                    .and(table.deviceId eq address.deviceId)
            }, null, updateStatement)
        }

        fun DeviceRecord.deleteByAddress(accountId: String, address: SignalProtocolAddress): Int {
            val table = this
            return (table as Table).deleteWhere {
                (table.accountId eq accountId)
                    .and(table.contactId eq address.name)
                    .and(table.deviceId eq address.deviceId)
            }
        }
    }
}
