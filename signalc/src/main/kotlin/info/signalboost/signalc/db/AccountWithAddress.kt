package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.*
import org.whispersystems.libsignal.SignalProtocolAddress

interface AccountWithAddress: FieldSet {
    val accountId: Column<String>
    val name: Column<String>
    val deviceId: Column<Int>

    companion object {

        fun AccountWithAddress.findByAddress(accountId: String, address: SignalProtocolAddress): ResultRow? {
            val table = this
            return table.select {
                table.accountId eq accountId
                table.name eq address.name
                table.deviceId eq address.deviceId
            }.singleOrNull()
        }

        fun AccountWithAddress.deleteByAddress(accountId: String, address: SignalProtocolAddress): Int {
            val table = this
            return (table as Table).deleteWhere {
                table.accountId eq accountId
                table.name eq address.name
                table.deviceId eq address.deviceId
            }
        }
    }
}
