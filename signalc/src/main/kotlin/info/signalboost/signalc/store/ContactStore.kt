package info.signalboost.signalc.store

import info.signalboost.signalc.Application
import info.signalboost.signalc.db.ContactRecord.Companion.findByContactId
import info.signalboost.signalc.db.ContactRecord.Companion.updateByContactId
import info.signalboost.signalc.db.Contacts
import info.signalboost.signalc.db.Profiles
import info.signalboost.signalc.dispatchers.Concurrency
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.runBlocking
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
class ContactStore(
    app: Application,
    // TODO: need to consume session lock for a given account?
) {

    companion object: Any(), KLoggable {
        override val logger = logger()
        private const val VALID_PROFILE_KEY_SIZE = 32
    }

    val dispatcher = Concurrency.Dispatcher
    val db = app.db

    suspend fun create(
        accountId: String,
        phoneNumber: String? = null,
        uuid: UUID? = null,
        profileKey: ByteArray? = null
    ): Int =
        newSuspendedTransaction(dispatcher, db) {
            Contacts.insert {
                it[Contacts.accountId] = accountId
                it[Contacts.phoneNumber] = phoneNumber
                it[Contacts.uuid] = uuid
                it[profileKeyBytes] = profileKey
            }
        }.resultedValues!!.single()[Contacts.contactId]

    suspend fun resolveContactIdSuspend(accountId: String, identifier: String): Int =
        newSuspendedTransaction (dispatcher, db) {
            resolveContactId(accountId, identifier)
        }

    fun resolveContactIdBlocking(accountId: String, identifier: String): Int =
        transaction(db) {
            resolveContactId(accountId, identifier)
        }

    private fun resolveContactId(accountId: String, identifier: String): Int {
        val uuid = parseUuid(identifier)
        return run {
            uuid
                ?.let {
                    logger.debug { "Found uuid: $uuid" }
                    Contacts.select { (Contacts.accountId eq accountId).and(Contacts.uuid eq it) }
                }
                ?: Contacts.select {
                    logger.debug { "Found phone number: $identifier" }
                    (Contacts.accountId eq accountId).and(Contacts.phoneNumber eq identifier)
                }
        }.single().let { it[Contacts.contactId] }
//            }.singleOrNull()
//            ?.let {
//                it[Contacts.contactId]
//            }
//            ?: runBlocking {
//                logger.debug { "Creating new contact w/ identifier: $uuid" }
//                val phoneNumber: String? = if(uuid == null) identifier else null
//                create(accountId, phoneNumber, uuid)
//            }
    }

    private fun parseUuid(identifier: String): UUID? =
        try {
            UUID.fromString(identifier)
        } catch(ignored: Throwable) {
            null
        }

    suspend fun storeUuid(accountId: String, contactPhoneNumber: String, contactUuid: UUID) {
        // TODO: this currently only adds a uuid to a phonenumber-based contact record
        // it shoudl be able to add either a uuid or aphonenumber
        newSuspendedTransaction(dispatcher, db) {
            val contactId = resolveContactId(accountId, contactPhoneNumber)
            Contacts.updateByContactId(accountId, contactId) {
                it[Contacts.uuid] = contactUuid
            }
        }
    }

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