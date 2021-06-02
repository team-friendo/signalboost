package info.signalboost.signalc.db

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import org.jetbrains.exposed.sql.Table
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime


@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
@ExperimentalTime
@ExperimentalPathApi
object Sessions: Table(), DeviceRecord  {
    private const val SESSION_BYTE_ARRAY_LENGTH = 32

    override val accountId = varchar("account_id", 255)
    override val contactId = varchar("contact_id", 255)
    override val deviceId = integer("device_id")
    val sessionBytes = binary("session_bytes", SESSION_BYTE_ARRAY_LENGTH)

    override val primaryKey = PrimaryKey(accountId, contactId, deviceId)
}