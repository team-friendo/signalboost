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
import java.time.Instant
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime


@ExperimentalCoroutinesApi
@ObsoleteCoroutinesApi
@ExperimentalPathApi
@ExperimentalTime
class ProtocolStore(val app: Application) {
    val db = app.db
    fun of(account: Account): AccountProtocolStore = AccountProtocolStore(
        db,
        account.username,
        // TODO: if we need to resolve race in signal sender for first incoming message,
        //  we might need to construct this in the constructor such that it consumes a session lock (for the account)...
        app.contactStore::resolveContactIdBlocking
    )

    fun countOwnIdentities(): Long =
        transaction(db) { OwnIdentities.selectAll().count() }

    class AccountProtocolStore(
        private val db: Database,
        private val accountId: String,
        private val resolveContactId: (String, String) -> Int,
        val lock: SessionLock = SessionLock(),
        // if we need to do above, we ahve to construct ContactStore
        private val identityStore: IdentityKeyStore = SignalcIdentityStore(db, accountId, lock, resolveContactId),
        private val preKeyStore: PreKeyStore = SignalcPreKeyStore(db, accountId, lock),
        private val senderKeyStore: SenderKeyStore = SignalcSenderKeyStore(db, accountId, lock),
        private val sessionStore: SignalServiceSessionStore = SignalcSessionStore(db, accountId, lock, resolveContactId),
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
        val removeOwnIdentity: () -> Unit = scIdentityStore::removeOwnIdentity
        val trustFingerprint: (SignalProtocolAddress, ByteArray) -> Unit = scIdentityStore::trustFingerprint
        val untrustFingerprint: (SignalProtocolAddress, ByteArray) -> Unit = scIdentityStore::untrustFingerprint
        val whenIdentityLastUpdated: (SignalProtocolAddress) -> Instant? = scIdentityStore::whenIdentityLastUpdated

        private val scPreKeyStore = preKeyStore as SignalcPreKeyStore
        val getLastPreKeyId: () -> Int = scPreKeyStore::getLastPreKeyId
        val storePreKeys: (List<PreKeyRecord>) -> Unit = scPreKeyStore::storePreKeys

        private val scSessionStore = sessionStore as SignalcSessionStore
        val archiveAllSessions: (SignalProtocolAddress) -> Unit = scSessionStore::archiveAllSessions

        private val scSignedPreKeyStore = signedPreKeyStore as SignalcSignedPreKeyStore
        val getLastSignedPreKeyId: () -> Int = scSignedPreKeyStore::getLastPreKeyId
    }
}