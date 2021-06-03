package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.`java-time`.timestamp
import java.time.Instant


object Identities: Table(), ContactRecord {
    private const val IDENTITY_KEY_BYTE_ARRAY_LENGTH = 33

    override val accountId = varchar("account_id", 255)
    override val contactId = integer("contact_id")
    val identityKeyBytes = binary("identity_key_bytes", IDENTITY_KEY_BYTE_ARRAY_LENGTH).index()
    val isTrusted = bool("is_trusted").default(true)
    val createdAt = timestamp("created_at").clientDefault { Instant.now() }
    val updatedAt = timestamp("updated_at").clientDefault { Instant.now() }

    override val primaryKey = PrimaryKey(accountId, contactId)
}