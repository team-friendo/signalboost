package info.signalboost.signalc.store


import info.signalboost.signalc.Application
import info.signalboost.signalc.db.OwnIdentities
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.store.protocol.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.groups.state.SenderKeyStore
import org.whispersystems.libsignal.state.IdentityKeyStore
import org.whispersystems.libsignal.state.PreKeyRecord
import org.whispersystems.libsignal.state.PreKeyStore
import org.whispersystems.libsignal.state.SignedPreKeyStore
import org.whispersystems.signalservice.api.SignalServiceProtocolStore
import org.whispersystems.signalservice.api.SignalServiceSessionStore
import java.time.Instant
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
        val countIdentitities: () -> Long = scIdentityStore::countIdentities
        val removeIdentity: (SignalProtocolAddress) -> Unit = scIdentityStore::removeIdentity
        val removeIdentities: () -> Unit = scIdentityStore::removeIdentities
        val removeOwnIdentity: () -> Unit = scIdentityStore::removeOwnIdentity
        val trustFingerprint: (SignalProtocolAddress, ByteArray) -> Unit = scIdentityStore::trustFingerprint
        val untrustFingerprint: (SignalProtocolAddress, ByteArray) -> Unit = scIdentityStore::untrustFingerprint
        val whenIdentityLastUpdated: (SignalProtocolAddress) -> Instant? = scIdentityStore::whenIdentityLastUpdated

        private val scPreKeyStore = preKeyStore as SignalcPreKeyStore
        val getLastPreKeyId: () -> Int = scPreKeyStore::getLastPreKeyId
        val removePreKeys: () -> Unit = scPreKeyStore::removePreKeys
        val storePreKeys: (List<PreKeyRecord>) -> Unit = scPreKeyStore::storePreKeys

        private val scSessionStore = sessionStore as SignalcSessionStore
        val archiveAllSessions: (SignalProtocolAddress) -> Unit = scSessionStore::archiveAllSessions
        val deleteAllSessionsOfAccount: () -> Unit = scSessionStore::deleteAllSessionsOfAccount

        private val scSignedPreKeyStore = signedPreKeyStore as SignalcSignedPreKeyStore
        val getLastSignedPreKeyId: () -> Int = scSignedPreKeyStore::getLastPreKeyId
        val removeSignedPreKeys: () -> Unit = scSignedPreKeyStore::removeSignedPreKeys

        fun deleteAllRecordsOfAccount() {
            removeOwnIdentity()
            removeIdentities()
            deleteAllSessionsOfAccount()
            removePreKeys()
            removeSignedPreKeys()
        }
    }
}