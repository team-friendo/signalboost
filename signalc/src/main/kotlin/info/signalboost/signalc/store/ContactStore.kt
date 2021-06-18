package info.signalboost.signalc.store

import info.signalboost.signalc.Application
import info.signalboost.signalc.db.ContactRecord.Companion.findByContactId
import info.signalboost.signalc.db.ContactRecord.Companion.updateByContactId
import info.signalboost.signalc.db.Contacts
import info.signalboost.signalc.db.Profiles
import info.signalboost.signalc.dispatchers.Concurrency
import info.signalboost.signalc.model.VerifiedAccount
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

    suspend fun createOwnContact(account: VerifiedAccount) = with(account) {
        create(accountId = username, phoneNumber = username, uuid = uuid, profileKey = profileKeyBytes)
    }


    private suspend fun resolveOrCreateContactIdSuspend(accountId: String, identifier: String): Int =
        newSuspendedTransaction (dispatcher, db) {
            resolveOrCreateContactId(accountId, identifier)
        }

    fun resolveOrCreateContactIdBlocking(accountId: String, identifier: String): Int =
        transaction(db) {
            resolveOrCreateContactId(accountId, identifier)
        }

    private fun resolveOrCreateContactId(accountId: String, identifier: String): Int {
        val uuid = parseUuid(identifier)
        return resolveContactId(accountId, identifier) ?: runBlocking {
            if(uuid == null) {
                create(accountId, identifier, null)
            } else {
                create(accountId, null, uuid)
            }
        }
    }

    suspend fun resolveContactIdSuspend(accountId: String, identifier: String): Int? =
        newSuspendedTransaction (dispatcher, db) {
            resolveContactId(accountId, identifier)
        }

    // resolve contact id when one identifier available
    private fun resolveContactId(accountId: String, identifier: String): Int? {
        val uuid = parseUuid(identifier)
        return run {
            uuid
                ?.let {
                    // logger.debug { "Found uuid: $uuid" }
                    Contacts.select { (Contacts.accountId eq accountId).and(Contacts.uuid eq it) }
                }
                ?: Contacts.select {
                    // logger.debug { "Found phone number: $identifier" }
                    (Contacts.accountId eq accountId).and(Contacts.phoneNumber eq identifier)
                }
        }.singleOrNull()?.let { it[Contacts.contactId] }
    }

    private fun parseUuid(identifier: String): UUID? =
        try {
            UUID.fromString(identifier)
        } catch(ignored: Throwable) {
            null
        }

    suspend fun storeUuidOrPhoneNumber(accountId: String, contactPhoneNumber: String, contactUuid: UUID) {
        newSuspendedTransaction(dispatcher, db){
            val contactId = resolveContactId(accountId, contactPhoneNumber)
                ?: resolveContactId(accountId, contactUuid.toString())
                ?: run {
                    logger.warn { "No contact ID found for phone number: $contactPhoneNumber, uuid: $contactUuid" }
                    return@newSuspendedTransaction
                }
            Contacts.updateByContactId(accountId, contactId) {
                it[Contacts.uuid] = contactUuid
                it[Contacts.phoneNumber] = contactPhoneNumber
            }
        }
    }

    suspend fun storeProfileKey(accountId: String, contactIdentifier: String, profileKey: ByteArray) {
        if (profileKey.size != VALID_PROFILE_KEY_SIZE) {
            logger.warn { "Received profile key of invalid size ${profileKey.size} for account: $contactIdentifier" }
            return
        }
        val contactId = resolveOrCreateContactIdSuspend(accountId, contactIdentifier)
        return newSuspendedTransaction(dispatcher, db) {
            Contacts.updateByContactId(accountId, contactId) {
                it[Contacts.profileKeyBytes] = profileKey
            }
        }
    }

    suspend fun loadProfileKey(accountId: String, contactIdentifier: String): ProfileKey? =
        newSuspendedTransaction(dispatcher, db) {
            val contactId = resolveOrCreateContactIdSuspend(accountId, contactIdentifier)
            Contacts.findByContactId(accountId, contactId)?.let { resultRow ->
                resultRow[Contacts.profileKeyBytes]?.let{ ProfileKey(it) }
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