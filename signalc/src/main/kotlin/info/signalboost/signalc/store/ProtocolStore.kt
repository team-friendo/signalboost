package info.signalboost.signalc.store


import info.signalboost.signalc.db.*
import info.signalboost.signalc.db.AccountWithAddress.Companion.deleteByAddress
import info.signalboost.signalc.db.AccountWithAddress.Companion.findByAddress
import info.signalboost.signalc.db.AccountWithAddress.Companion.updateByAddress
import info.signalboost.signalc.db.Identities.identityKeyBytes
import info.signalboost.signalc.db.Identities.isTrusted
import info.signalboost.signalc.db.Identities.name
import info.signalboost.signalc.db.Sessions.sessionBytes
import info.signalboost.signalc.dispatchers.Concurrency
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.util.KeyUtil
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.groups.state.SenderKeyRecord
import org.whispersystems.libsignal.protocol.CiphertextMessage
import org.whispersystems.libsignal.state.IdentityKeyStore
import org.whispersystems.libsignal.state.PreKeyRecord
import org.whispersystems.libsignal.state.SessionRecord
import org.whispersystems.libsignal.state.SignedPreKeyRecord
import org.whispersystems.signalservice.api.SignalServiceProtocolStore
import org.whispersystems.signalservice.api.SignalSessionLock
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.UUID
import kotlin.jvm.Throws


class ProtocolStore(private val db: Database) {
    fun of(account: Account): AccountProtocolStore = AccountProtocolStore(db, account.username)

    fun countOwnIdentities(): Long =
        transaction(db) { OwnIdentities.selectAll().count() }

    class AccountProtocolStore(
        private val db: Database,
        private val accountId: String,
    ): SignalServiceProtocolStore {

        val lock: SignalSessionLock = SessionLock()

        /********* IDENTITIES *********/

        override fun getIdentityKeyPair(): IdentityKeyPair =
            lock.acquire().use { _ ->
                transaction(db) {
                    OwnIdentities.select {
                        OwnIdentities.accountId eq accountId
                    }.singleOrNull() ?: createOwnIdentity()
                }.let {
                    IdentityKeyPair(it[OwnIdentities.keyPairBytes])
                }
            }

        override fun getLocalRegistrationId(): Int =
            lock.acquire().use { _ ->
                transaction(db) {
                    OwnIdentities.select {
                        OwnIdentities.accountId eq accountId
                    }.singleOrNull() ?: createOwnIdentity()
                }[OwnIdentities.registrationId]
            }

        private fun createOwnIdentity(): ResultRow =
            transaction(db) {
                OwnIdentities.insert {
                    it[PreKeys.accountId] = this@AccountProtocolStore.accountId
                    it[keyPairBytes] = KeyUtil.genIdentityKeyPair().serialize()
                    it[registrationId] = KeyUtil.genRegistrationId()
                }.resultedValues!![0]
            }

        fun saveFingerprintForAllIdentities(address: SignalServiceAddress, fingerprint: ByteArray) =
            lock.acquire().use { _ ->
                transaction(db) {
                    Identities.update({
                        (name eq address.identifier)
                            .and(Identities.accountId eq this@AccountProtocolStore.accountId)
                    }) {
                        it[identityKeyBytes] = fingerprint
                    }
                }
            }

        fun trustFingerprintForAllIdentities(fingerprint: ByteArray) =
            lock.acquire().use { _ ->
                transaction(db) {
                    Identities.update({ identityKeyBytes eq fingerprint }) {
                        it[isTrusted] = true
                    }
                }
            }

        override fun saveIdentity(address: SignalProtocolAddress, identityKey: IdentityKey): Boolean =
            // Insert or update an idenity key and:
            // - trust the first identity key seen for a given address
            // - deny trust for subsequent identity keys for same address
            // Returns true if this save was an update to an existing record, false otherwise
            lock.acquire().use { _ ->
                transaction(db) {
                    Identities.findByAddress(accountId, address)
                        ?.let { existingKey ->
                            Identities.updateByAddress(accountId, address) {
                                // store the new existingKey key in all cases
                                it[identityKeyBytes] = identityKey.serialize()
                                // only trust it if it matches the existing key
                                it[isTrusted] = existingKey[identityKeyBytes] contentEquals identityKey.serialize()
                            }
                            true
                        } ?: run {
                        Identities.insert {
                            it[accountId] = this@AccountProtocolStore.accountId
                            it[name] = address.name
                            it[deviceId] = address.deviceId
                            it[identityKeyBytes] = identityKey.serialize()
                        }
                        false
                    }
                }
            }

        override fun isTrustedIdentity(
            address: SignalProtocolAddress,
            identityKey: IdentityKey,
            direction: IdentityKeyStore.Direction
        ): Boolean =
            lock.acquire().use { _ ->
                transaction(db) {
                    // trust a key if...
                    Identities.findByAddress(accountId, address)?.let {
                        // it matches a key we have seen before
                        it[identityKeyBytes] contentEquals identityKey.serialize() &&
                                // and we have not flagged it as untrusted
                                it[isTrusted]
                    } ?: true // or it is the first key we ever seen for a person (TOFU!)
                }
            }

        override fun getIdentity(address: SignalProtocolAddress): IdentityKey? =
            lock.acquire().use { _ ->
                transaction(db) {
                    Identities.findByAddress(accountId, address)?.let {
                        IdentityKey(it[identityKeyBytes], 0)
                    }
                }
            }

        fun removeIdentity(address: SignalProtocolAddress) {
            lock.acquire().use { _ ->
                transaction(db) {
                    Identities.deleteByAddress(accountId, address)
                }
            }
        }


        fun removeOwnIdentity() {
            lock.acquire().use { _ ->
                transaction(db) {
                    OwnIdentities.deleteWhere {
                        OwnIdentities.accountId eq accountId
                    }
                }
            }
        }

        /********* PREKEYS *********/

        @Throws(InvalidKeyException::class)
        override fun loadPreKey(preKeyId: Int): PreKeyRecord =
            lock.acquire().use { _ ->
                transaction(db) {
                    PreKeys.select {
                        PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
                    }.singleOrNull()?.let {
                        PreKeyRecord(it[PreKeys.preKeyBytes])
                    } ?: throw InvalidKeyException()
                }
            }

        suspend fun getLastPreKeyId(): Int =
            lock.acquire().use { _ ->
                newSuspendedTransaction(Concurrency.Dispatcher, db) {
                    PreKeys
                        .slice(PreKeys.preKeyId)
                        .select { PreKeys.accountId eq accountId }
                        .orderBy(PreKeys.preKeyId to SortOrder.DESC)
                        .limit(1)
                        .singleOrNull()?.let { it[PreKeys.preKeyId] } ?: 0
                }
            }

        override fun storePreKey(preKeyId: Int, record: PreKeyRecord) {
            lock.acquire().use { _ ->
                transaction(db) {
                    PreKeys.update({
                        PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
                    }) {
                        it[preKeyBytes] = record.serialize()
                    }.let { numUpdated ->
                        if (numUpdated == 0) {
                            PreKeys.insert {
                                it[accountId] = this@AccountProtocolStore.accountId
                                it[this.preKeyId] = preKeyId
                                it[preKeyBytes] = record.serialize()
                            }
                        }
                    }
                }
            }
        }

        override fun containsPreKey(preKeyId: Int): Boolean =
            lock.acquire().use { _ ->
                transaction(db) {
                    PreKeys.select {
                        PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
                    }.count() > 0
                }
            }


        override fun removePreKey(preKeyId: Int) {
            lock.acquire().use { _ ->
                transaction(db) {
                    PreKeys.deleteWhere {
                        PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
                    }
                }
            }
        }


        /********* SIGNED PREKEYS *********/

        override fun loadSignedPreKey(signedPreKeyId: Int): SignedPreKeyRecord =
            lock.acquire().use { _ ->
                transaction(db) {
                    SignedPreKeys.select {
                        SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
                    }.singleOrNull()?.get(SignedPreKeys.signedPreKeyBytes)
                }?.let { SignedPreKeyRecord(it) } ?: throw InvalidKeyException()
            }


        override fun loadSignedPreKeys(): MutableList<SignedPreKeyRecord> =
            lock.acquire().use { _ ->
                transaction(db) {
                    SignedPreKeys.selectAll().map {
                        it[SignedPreKeys.signedPreKeyBytes]
                    }
                }.mapTo(mutableListOf()) { SignedPreKeyRecord(it) }
            }

        override fun storeSignedPreKey(signedPreKeyId: Int, record: SignedPreKeyRecord) {
            lock.acquire().use { _ ->
                transaction(db) {
                    SignedPreKeys.update({
                        SignedPreKeys.accountId eq accountId and (
                                SignedPreKeys.preKeyId eq signedPreKeyId
                                )
                    }) {
                        it[signedPreKeyBytes] = record.serialize()
                    }.let { numUpdated ->
                        if (numUpdated == 0) {
                            SignedPreKeys.insert {
                                it[accountId] = this@AccountProtocolStore.accountId
                                it[preKeyId] = signedPreKeyId
                                it[signedPreKeyBytes] = record.serialize()
                            }
                        }
                    }
                }
            }
        }

        override fun containsSignedPreKey(signedPreKeyId: Int): Boolean =
            lock.acquire().use { _ ->
                transaction(db) {
                    SignedPreKeys.select {
                        SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
                    }.singleOrNull()?.let { true } ?: false
                }
            }

        override fun removeSignedPreKey(signedPreKeyId: Int) {
            lock.acquire().use { _ ->
                transaction(db) {
                    SignedPreKeys.deleteWhere {
                        SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
                    }
                }
            }
        }

        /********* SENDER KEYS *********/

        override fun storeSenderKey(sender: SignalProtocolAddress, distributionId: UUID, record: SenderKeyRecord) {
            lock.acquire().use { _ ->
                transaction(db) {
                    SenderKeys.update ({
                        (SenderKeys.accountId eq accountId)
                            .and(SenderKeys.name eq sender.name)
                            .and(SenderKeys.deviceId eq sender.deviceId)
                            .and( SenderKeys.distributionId eq distributionId)
                    }) {
                        it[senderKeyBytes] = record.serialize()
                    }.let { numUpdated ->
                        if(numUpdated == 0) createSenderKey(sender, distributionId)
                    }
                }
            }
        }

        override fun loadSenderKey(sender: SignalProtocolAddress, distributionId: UUID): SenderKeyRecord =
            lock.acquire().use { _ ->
                transaction(db) {
                    SenderKeys.select {
                        (SenderKeys.accountId eq accountId)
                            .and(SenderKeys.name eq sender.name)
                            .and(SenderKeys.deviceId eq sender.deviceId)
                            .and( SenderKeys.distributionId eq distributionId)
                    }.singleOrNull()
                        ?: createSenderKey(sender, distributionId)
                }.let {
                    SenderKeyRecord(it[SenderKeys.senderKeyBytes])
                }
            }

        private fun createSenderKey(sender: SignalProtocolAddress, distributionId: UUID): ResultRow =
            SenderKeys.insert {
                it[accountId] = this@AccountProtocolStore.accountId
                it[name] = sender.name
                it[deviceId] = sender.deviceId
                it[this.distributionId] = distributionId
                it[senderKeyBytes] = SenderKeyRecord().serialize()
            }.resultedValues!![0]


        /********* SESSIONS *********/

        override fun loadSession(address: SignalProtocolAddress): SessionRecord =
            lock.acquire().use { _ ->
                transaction(db) {
                    Sessions.findByAddress(accountId, address)?.let {
                        SessionRecord(it[sessionBytes])
                    } ?: SessionRecord()
                }
            }

        override fun getSubDeviceSessions(name: String): MutableList<Int> {
            lock.acquire().use { _ ->
                return transaction(db) {
                    Sessions.select {
                        Sessions.accountId eq accountId and (Sessions.name eq name)
                    }.mapTo(mutableListOf()) { it[Sessions.deviceId] }
                }
            }
        }

        override fun storeSession(address: SignalProtocolAddress, record: SessionRecord) {
            // upsert the session record for a given address
            lock.acquire().use { _ ->
                transaction(db) {
                    Sessions.updateByAddress(accountId, address) {
                        it[sessionBytes] = record.serialize()
                    }.let { numUpdated ->
                        if (numUpdated == 0) {
                            Sessions.insert {
                                it[accountId] = this@AccountProtocolStore.accountId
                                it[name] = address.name
                                it[deviceId] = address.deviceId
                                it[sessionBytes] = record.serialize()
                            }
                        }
                    }
                }
            }
        }

        override fun containsSession(address: SignalProtocolAddress): Boolean =
            lock.acquire().use { _ ->
                transaction(db) {
                    Sessions.findByAddress(accountId, address)?.let {
                        val sessionRecord = SessionRecord(it[sessionBytes])
                        sessionRecord.hasSenderChain()
                                && sessionRecord.sessionVersion == CiphertextMessage.CURRENT_VERSION;
                    } ?: false
                }
            }


        override fun deleteSession(address: SignalProtocolAddress) {
            lock.acquire().use { _ ->
                transaction(db) {
                    Sessions.deleteByAddress(accountId, address)
                }
            }
        }

        override fun deleteAllSessions(name: String) {
            lock.acquire().use { _ ->
                transaction(db) {
                    Sessions.deleteWhere {
                        Sessions.accountId eq accountId and (Sessions.name eq name)
                    }
                }
            }
        }

        override fun archiveSession(address: SignalProtocolAddress) {
            lock.acquire().use { _ ->
                transaction(db) {
                    Sessions.findByAddress(accountId, address)?.let {
                        val session = SessionRecord(it[sessionBytes])
                        session.archiveCurrentState()
                        storeSession(address, session)
                    }
                }
            }
        }
    }
}