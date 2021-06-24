package info.signalboost.signalc.store

import info.signalboost.signalc.Application
import info.signalboost.signalc.db.ContactRecord.Companion.findByContactId
import info.signalboost.signalc.db.ContactRecord.Companion.updateByContactId
import info.signalboost.signalc.db.Contacts
import info.signalboost.signalc.dispatchers.Concurrency
import info.signalboost.signalc.model.SignalcAddress
import info.signalboost.signalc.model.VerifiedAccount
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.runBlocking
import mu.KLoggable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction
import org.signal.zkgroup.profiles.ProfileKey
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import java.lang.IllegalStateException
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

    suspend fun create(accountId: String, phoneNumber: String?, uuid: UUID?, profileKey: ByteArray? = null): Int =
        if (phoneNumber == null && uuid == null)
            throw IllegalStateException("Cannot create contact w/o phone number or uuid")
        else newSuspendedTransaction(dispatcher, db) {
            Contacts.insert {
                it[Contacts.accountId] = accountId
                it[Contacts.phoneNumber] = phoneNumber
                it[Contacts.uuid] = uuid
                it[profileKeyBytes] = profileKey
            }
        }.resultedValues!!.single()[Contacts.contactId]

    suspend fun create(account: VerifiedAccount, envelope: SignalServiceEnvelope): Int =
        create(account.id, envelope.sourceE164.orNull(), envelope.sourceUuid.orNull()?.let { UUID.fromString(it) } )

    suspend fun createOwnContact(account: VerifiedAccount) = with(account) {
        create(accountId = username, phoneNumber = username, uuid = uuid, profileKey = profileKeyBytes)
    }

    /**
     * Given a string identifier that may be either a uuid or a phone number,
     * Report whether a contact exists containing either that uuid or phone number.
     */
    suspend fun hasContact(accountId: String, contactIdentifier: String): Boolean =
        newSuspendedTransaction(Concurrency.Dispatcher, db) {
            Contacts.select {
                (Contacts.accountId eq accountId).and(
                    (Contacts.phoneNumber eq contactIdentifier).or(Contacts.uuid eq parseUuid(contactIdentifier))
                )
            }.count() > 0
        }

    /**
     * Given a string identifier that may be either a uuid or a phone number,
     * Retrieve a contact having either such identifier and convert it into a SignalcAddress
     */
    suspend fun getContactAddress(accountId: String, contactIdentifier: String): SignalcAddress? =
        newSuspendedTransaction(Concurrency.Dispatcher, db) {
            Contacts.select {
                (Contacts.accountId eq accountId).and(
                    (Contacts.uuid eq parseUuid(contactIdentifier)).or(Contacts.phoneNumber eq contactIdentifier)
                )
            }.singleOrNull()
        }?.let { SignalcAddress(uuid = it[Contacts.uuid], number = it[Contacts.phoneNumber]) }

    /**
     * Given a string identifier -- which may be either a uuid or a phone number -- retrieve the contact having
     * that uuid or phone number if it exists or create a new contact if it does not exist.
     * This function accepts a Transaction as an argument so that it may be called from either a blocking or
     * suspend contexts. Since most callers will be signal protocol store functions (which are all blocking),
     * the argument defaults to a blocking transaction.
     **/
    fun resolveContactId(accountId: String, contactIdentifier: String, tx: Transaction? = null): Int {
        val uuid = parseUuid(contactIdentifier)
        val statement = {
            run {
                uuid
                    ?.let { Contacts.select { (Contacts.accountId eq accountId).and(Contacts.uuid eq it) } }
                    ?: Contacts.select { (Contacts.accountId eq accountId).and(Contacts.phoneNumber eq contactIdentifier) }
            }.singleOrNull()
                ?.let { it[Contacts.contactId] }
                ?: runBlocking {
                    if (uuid == null) create(accountId, contactIdentifier, null)
                    else create(accountId, null, uuid)
                }
        }
        return tx?.let  { statement() } ?: transaction(db) {  statement() }
    }

   /**
    * Given a uuid and a phone number, store the uuid if we already have the phone number, or the phone number
    * if we already have the uuid. Since most contacts start with a phone number, attempt to store the uuid first
    * and return early if we succeed. Throw if we cannot find a contact with either uuid or phone number.
    **/
    suspend fun storeMissingIdentifier(accountId: String, contactPhoneNumber: String, contactUuid: UUID) {
        newSuspendedTransaction(dispatcher, db) {

            Contacts.update({
                (Contacts.accountId eq accountId).and(Contacts.phoneNumber eq contactPhoneNumber)
            }){
                it[uuid] = contactUuid
            }.let {
                if(it > 0) return@newSuspendedTransaction
            }

            Contacts.update({
                (Contacts.accountId eq accountId).and(Contacts.uuid eq contactUuid)
            }){
                it[phoneNumber] = contactPhoneNumber
            }.let {
                if(it > 0) return@newSuspendedTransaction
            }

            throw IllegalStateException(
                "Can't store missing identifier without a known identifier- PN: $contactPhoneNumber, UUID: $contactUuid"
            )
        }
    }

    suspend fun storeProfileKey(accountId: String, contactIdentifier: String, profileKey: ByteArray) {
        if (profileKey.size != VALID_PROFILE_KEY_SIZE) {
            logger.warn { "Received profile key of invalid size ${profileKey.size} for account: $contactIdentifier" }
            return
        }
        return newSuspendedTransaction(dispatcher, db) {
            val contactId = resolveContactId(accountId, contactIdentifier, this)
            Contacts.updateByContactId(accountId, contactId) {
                it[Contacts.profileKeyBytes] = profileKey
            }
        }
    }

    suspend fun loadProfileKey(accountId: String, contactIdentifier: String): ProfileKey? =
        newSuspendedTransaction(dispatcher, db) {
            val contactId = resolveContactId(accountId, contactIdentifier, this)
            Contacts.findByContactId(accountId, contactId)?.let { resultRow ->
                resultRow[Contacts.profileKeyBytes]?.let{ ProfileKey(it) }
            }
        }

    // HELPERS

    private fun parseUuid(identifier: String): UUID? =
        try { UUID.fromString(identifier) } catch(ignored: Throwable) { null }

    // TESTING FUNCTIONS
    internal suspend fun count(): Long = newSuspendedTransaction(dispatcher, db) {
        Contacts.selectAll().count()
    }

    internal suspend fun deleteAllFor(accountId: String) = newSuspendedTransaction(dispatcher, db) {
        Contacts.deleteWhere {
            Contacts.accountId eq accountId
        }
    }
}