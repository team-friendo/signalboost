package info.signalboost.signalc.store

import info.signalboost.signalc.Application
import info.signalboost.signalc.db.Profiles
import info.signalboost.signalc.dispatchers.Concurrency
import info.signalboost.signalc.serialization.ByteArrayEncoding.toPostgresHex
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.signal.zkgroup.profiles.ProfileKey
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalCoroutinesApi
@ObsoleteCoroutinesApi
@ExperimentalPathApi
@ExperimentalTime
class ProfileStore(app: Application) {
    val dispatcher = Concurrency.Dispatcher
    val db = app.db

    suspend fun storeProfileKey(accountId: String, contactId: String, profileKey: ByteArray): Unit =
        newSuspendedTransaction(dispatcher, db) {
            val escapedProfileKey = profileKey.toPostgresHex()
            exec("INSERT into profiles (account_id, contact_id, profile_key_bytes) " +
                    "VALUES('$accountId','$contactId', $escapedProfileKey) " +
                    "ON CONFLICT (account_id, contact_id)" +
                    "DO UPDATE set profile_key_bytes = EXCLUDED.profile_key_bytes;"
            )
        }

    suspend fun loadProfileKey(accountId: String, contactId: String): ProfileKey? =
        newSuspendedTransaction(dispatcher, db) {
            Profiles.select {
                (Profiles.accountId eq accountId).and(
                    Profiles.contactId eq contactId
                )
            }.singleOrNull()?.let {
                ProfileKey(it[Profiles.profileKeyBytes])
            }
        }

    // TESTING FUNCTIONS
    internal suspend fun count(): Long = newSuspendedTransaction(dispatcher, db) {
        Profiles.selectAll().count()
    }

    internal suspend fun deleteAllFor(accountId: String) = newSuspendedTransaction(dispatcher, db) {
        Profiles.deleteWhere {
            Profiles.accountId eq accountId
        }
    }


}