package info.signalboost.signalc.store


import info.signalboost.signalc.db.*
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.store.protocol.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.groups.state.SenderKeyStore
import org.whispersystems.libsignal.state.*
import org.whispersystems.signalservice.api.SignalServiceProtocolStore
import org.whispersystems.signalservice.api.SignalServiceSessionStore
import org.whispersystems.signalservice.api.push.SignalServiceAddress


class ProtocolStore(private val db: Database) {
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