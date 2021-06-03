package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.FieldSet
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.statements.UpdateStatement


interface ContactRecord: FieldSet {
    val accountId: Column<String>
    val contactId: Column<String>

    companion object {

        fun ContactRecord.findByContactId(accountId: String, contactId: String): ResultRow? {
            val table = this
            return table.select {
                (table.accountId eq accountId).and(table.contactId eq contactId)
            }.singleOrNull()
        }

        fun ContactRecord.findManyByContactId(accountId: String, contactId: String): List<ResultRow> {
            val table = this
            return table.select {
                (table.accountId eq accountId).and(table.contactId eq contactId)
            }.toList()
        }

        fun ContactRecord.updateByContactId(
            accountId: String,
            contactId: String,
            updateStatement: Table.(UpdateStatement) -> Unit
        ): Int {
            val table = this
            return (table as Table).update ({
                (table.accountId eq accountId).and(table.contactId eq contactId)
            }, null, updateStatement)
        }

        fun ContactRecord.deleteByContactId(accountId: String, contactId: String): Int {
            val table = this
            return (table as Table).deleteWhere {
                (table.accountId eq accountId).and(table.contactId eq contactId)
            }
        }
    }
}