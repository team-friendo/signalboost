package info.signalboost.signalc.store.protocol

import info.signalboost.signalc.db.AccountWithAddress.Companion.deleteByAddress
import info.signalboost.signalc.db.AccountWithAddress.Companion.findByAddress
import info.signalboost.signalc.db.AccountWithAddress.Companion.updateByAddress
import info.signalboost.signalc.db.Identities
import info.signalboost.signalc.db.Identities.identityKeyBytes
import info.signalboost.signalc.db.Identities.isTrusted
import info.signalboost.signalc.db.Identities.name
import info.signalboost.signalc.db.OwnIdentities
import info.signalboost.signalc.db.PreKeys
import info.signalboost.signalc.util.KeyUtil
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.IdentityKeyStore
import org.whispersystems.signalservice.api.push.SignalServiceAddress


class SignalcIdentityStore(
    val db: Database,
    val accountId: String,
    val lock: SessionLock,
): IdentityKeyStore{

    override fun getIdentityKeyPair(): IdentityKeyPair =
        lock.acquireForTransaction(db) {
            OwnIdentities.select {
                OwnIdentities.accountId eq accountId
            }.singleOrNull() ?: createOwnIdentity()
        }.let {
            IdentityKeyPair(it[OwnIdentities.keyPairBytes])
        }


    override fun getLocalRegistrationId(): Int =
        lock.acquireForTransaction(db) {
            OwnIdentities.select {
                OwnIdentities.accountId eq accountId
            }.singleOrNull() ?: createOwnIdentity()
        }[OwnIdentities.registrationId]


    private fun createOwnIdentity(): ResultRow =
        transaction(db) {
            OwnIdentities.insert {
                it[PreKeys.accountId] = this@SignalcIdentityStore.accountId
                it[keyPairBytes] = KeyUtil.genIdentityKeyPair().serialize()
                it[registrationId] = KeyUtil.genRegistrationId()
            }.resultedValues!![0]
        }

    fun saveFingerprintForAllIdentities(address: SignalServiceAddress, fingerprint: ByteArray) {
        lock.acquireForTransaction(db) {
            Identities.update({
                (name eq address.identifier)
                    .and(Identities.accountId eq this@SignalcIdentityStore.accountId)
            }) {
                it[identityKeyBytes] = fingerprint
            }
        }
    }

    fun trustFingerprintForAllIdentities(fingerprint: ByteArray) {
        lock.acquireForTransaction(db) {
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
        lock.acquireForTransaction(db) {
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
                    it[accountId] = this@SignalcIdentityStore.accountId
                    it[name] = address.name
                    it[deviceId] = address.deviceId
                    it[identityKeyBytes] = identityKey.serialize()
                }
                false
            }
        }

    override fun isTrustedIdentity(
        address: SignalProtocolAddress,
        identityKey: IdentityKey,
        direction: IdentityKeyStore.Direction
    ): Boolean =
        lock.acquireForTransaction(db) {
            // trust a key if...
            Identities.findByAddress(accountId, address)?.let {
                // it matches a key we have seen before
                it[identityKeyBytes] contentEquals identityKey.serialize() &&
                        // and we have not flagged it as untrusted
                        it[isTrusted]
            } ?: true // or it is the first key we ever seen for a person (TOFU!)
        }

    override fun getIdentity(address: SignalProtocolAddress): IdentityKey? =
        lock.acquireForTransaction(db) {
            Identities.findByAddress(accountId, address)?.let {
                IdentityKey(it[identityKeyBytes], 0)
            }
        }

    fun removeIdentity(address: SignalProtocolAddress) {
        lock.acquireForTransaction(db) {
            Identities.deleteByAddress(accountId, address)
        }
    }

    fun removeOwnIdentity() {
        lock.acquireForTransaction(db) {
            OwnIdentities.deleteWhere {
                OwnIdentities.accountId eq accountId
            }
        }
    }


}