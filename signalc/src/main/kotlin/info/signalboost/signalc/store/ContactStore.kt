package info.signalboost.signalc.store

import info.signalboost.signalc.Application
import info.signalboost.signalc.db.ContactRecord.Companion.findByContactId
import info.signalboost.signalc.db.ContactRecord.Companion.updateByContactId
import info.signalboost.signalc.db.Contacts
import info.signalboost.signalc.db.Profiles
import info.signalboost.signalc.dispatchers.Concurrency
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import mu.KLoggable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction
import org.signal.zkgroup.profiles.ProfileKey
import java.util.UUID
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalCoroutinesApi
@ObsoleteCoroutinesApi
@ExperimentalPathApi
@ExperimentalTime
class ContactStore(app: Application) {
    companion object: Any(), KLoggable {
        override val logger = logger()
        private const val VALID_PROFILE_KEY_SIZE = 32
    }

    val dispatcher = Concurrency.Dispatcher
    val db = app.db

    suspend fun create(accountId: String, phoneNumber: String, uuid: UUID? = null, profileKey: ByteArray? = null) =
        newSuspendedTransaction(dispatcher, db) {
            Contacts.insert {
                it[Contacts.accountId] = accountId
                it[Contacts.phoneNumber] = phoneNumber
                it[Contacts.uuid] = uuid
                it[profileKeyBytes] = profileKey
            }
        }


    suspend fun resolveContactIdSuspend(accountId: String, identifier: String): Int =
        newSuspendedTransaction (dispatcher, db) {
            resolveContactId(identifier, accountId)
        }

    fun resolveContactIdBlocking(accountId: String, identifier: String): Int =
        transaction(db) {
            resolveContactId(identifier, accountId)
        }

    private fun resolveContactId(identifier: String, accountId: String) = try {
        val uuid = UUID.fromString(identifier)
        Contacts.select {
            (Contacts.accountId eq accountId).and(Contacts.uuid eq uuid)
        }
    } catch (ignored: Throwable) {
        Contacts.select {
            (Contacts.accountId eq accountId).and(Contacts.phoneNumber eq identifier)
        }
    }.single()[Contacts.contactId]


    suspend fun storeProfileKey(accountId: String, contactIdentifier: String, profileKey: ByteArray) {
        if (profileKey.size != VALID_PROFILE_KEY_SIZE) {
            logger.warn { "Received profile key of invalid size ${profileKey.size} for account: $contactIdentifier" }
            return
        }
        val contactId = resolveContactIdSuspend(accountId, contactIdentifier)
        return newSuspendedTransaction(dispatcher, db) {
            Contacts.updateByContactId(accountId, contactId) {
                it[Contacts.profileKeyBytes] = profileKey
            }
        }
    }

    suspend fun loadProfileKey(accountId: String, contactIdentifier: String): ProfileKey? =
        newSuspendedTransaction(dispatcher, db) {
            val contactId = resolveContactIdSuspend(accountId, contactIdentifier)
            Contacts.findByContactId(accountId, contactId)?.let {
                ProfileKey(it[Contacts.profileKeyBytes])
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