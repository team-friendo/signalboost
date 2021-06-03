package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.statements.UpdateStatement

interface DeviceRecord: FieldSet {
    val accountId: Column<String>
    val contactId: Column<Int>
    val deviceId: Column<Int>

    companion object {

        fun DeviceRecord.findByDeviceId(accountId: String, contactId: Int, deviceId: Int): ResultRow? {
            val table = this
            return table.select {
                (table.accountId eq accountId)
                    .and(table.contactId eq contactId)
                    .and(table.deviceId eq deviceId)
            }.singleOrNull()
        }

        fun DeviceRecord.updateByDeviceId(
            accountId: String,
            contactId: Int,
            deviceId: Int,
            updateStatement: Table.(UpdateStatement) -> Unit
        ): Int {
            val table = this
            return (table as Table).update ({
                (table.accountId eq accountId)
                    .and(table.contactId eq contactId)
                    .and(table.deviceId eq deviceId)
            }, null, updateStatement)
        }

        fun DeviceRecord.deleteByDeviceId(accountId: String, contactId: Int, deviceId: Int): Int {
            val table = this
            return (table as Table).deleteWhere {
                (table.accountId eq accountId)
                    .and(table.contactId eq contactId)
                    .and(table.deviceId eq deviceId)
            }
        }
    }
}
