package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

object Contacts: Table() {
    val accountId = varchar("account_id", 255)
    val contactId = integer("contact_id").autoIncrement()
    val uuid = uuid("uuid").nullable()
    val phoneNumber = varchar("phone_number", 255)
    val profileKeyBytes = binary("profile_key_bytes").nullable()

    override val primaryKey = PrimaryKey(accountId, contactId)

    init {
        index(isUnique = true, accountId, phoneNumber)
        index(isUnique = true, accountId, uuid)
    }
}
