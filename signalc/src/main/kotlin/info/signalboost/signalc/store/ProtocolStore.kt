package info.signalboost.signalc.store


import info.signalboost.signalc.Application
import info.signalboost.signalc.db.*
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.store.protocol.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.groups.state.SenderKeyStore
import org.whispersystems.libsignal.state.*
import org.whispersystems.signalservice.api.SignalServiceProtocolStore
import org.whispersystems.signalservice.api.SignalServiceSessionStore
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.*
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime


@ExperimentalCoroutinesApi
@ObsoleteCoroutinesApi
@ExperimentalPathApi
@ExperimentalTime
class ProtocolStore(app: Application) {
    val db = app.db
    fun of(account: Account): AccountProtocolStore = AccountProtocolStore(db, account.username)

    fun countOwnIdentities(): Long =
        transaction(db) { OwnIdentities.selectAll().count() }

    companion object {
        fun resolveId(contactId: String): String {
            return when {
                isUUID(contactId) -> {
                    when (contactId) {
                        "362feb8e-17a0-402b-92d8-773df1b38a74" -> "+16154804259"
                        "1b2f2a81-38ee-49db-8be4-b450f83bfcf9" -> "+18319176400"
                        else -> throw Exception("oh noes! don't know this UUID: $contactId")
                    }
                }
                isE164(contactId) -> {
                    contactId
                }
                else -> {
                    throw Exception("what the h*** is this? don't know this contact id type, contact id: $contactId")
                }
            }
        }

        private fun isE164(contactId: String): Boolean {
            val regex = """^\+\d{9,15}$""".toRegex()
            return regex.matches(contactId)
        }

        private fun isUUID(contactId: String): Boolean {
            return try {
                UUID.fromString(contactId)
                true
            } catch (e: Throwable) {
                false
            }
        }
    }

    class AccountProtocolStore(
        private val db: Database,
        private val accountId: String,
        val lock: SessionLock = SessionLock(),
        private val identityStore: IdentityKeyStore = SignalcIdentityStore(db, accountId, lock),
        private val preKeyStore: PreKeyStore = SignalcPreKeyStore(db, accountId, lock),
        private val senderKeyStore: SenderKeyStore = SignalcSenderKeyStore(db, accountId, lock),
        private val sessionStore: SignalServiceSessionStore = SignalcSessionStore(db, accountId, lock),
        private val signedPreKeyStore: SignedPreKeyStore = SignalcSignedPreKeyStore(db, accountId, lock),
    ) : SignalServiceProtocolStore,
        IdentityKeyStore by identityStore,
        PreKeyStore by preKeyStore,
        SenderKeyStore by senderKeyStore,
        SignalServiceSessionStore by sessionStore,
        SignedPreKeyStore by signedPreKeyStore {

        /**
         * DECORATOR FUNCTIONS
         **/

        private val scIdentityStore = identityStore as SignalcIdentityStore
        val removeIdentity: (SignalProtocolAddress) -> Unit = scIdentityStore::removeIdentity
        val removeOwnIdentity: () -> Unit = scIdentityStore::removeOwnIdentity
        val saveFingerprintForAllIdentities: (SignalServiceAddress, ByteArray) -> Unit =
            scIdentityStore::saveFingerprintForAllIdentities
        val trustFingerprintForAllIdentities: (ByteArray) -> Unit =
           scIdentityStore::trustFingerprintForAllIdentities

        private val scPreKeyStore = preKeyStore as SignalcPreKeyStore
        val getLastPreKeyId: () -> Int = scPreKeyStore::getLastPreKeyId
        val storePreKeys: (List<PreKeyRecord>) -> Unit = scPreKeyStore::storePreKeys

        private val scSignedPreKeyStore = signedPreKeyStore as SignalcSignedPreKeyStore
        val getLastSignedPreKeyId: () -> Int = scSignedPreKeyStore::getLastPreKeyId
    }
}