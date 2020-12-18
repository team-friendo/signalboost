package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

const val PREKEY_BYTE_ARRAY_LENGTH = 71

object PreKeys: Table() {
    val id = integer("id")
    val preKeyBytes = binary("prekey_bytes", PREKEY_BYTE_ARRAY_LENGTH)
    override val primaryKey = PrimaryKey(id)
}
