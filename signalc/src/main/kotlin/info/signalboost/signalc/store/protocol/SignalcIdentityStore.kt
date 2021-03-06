package info.signalboost.signalc.store.protocol

import info.signalboost.signalc.db.ContactRecord.Companion.deleteByContactId
import info.signalboost.signalc.db.ContactRecord.Companion.findByContactId
import info.signalboost.signalc.db.ContactRecord.Companion.updateByContactId
import info.signalboost.signalc.db.Identities
import info.signalboost.signalc.db.Identities.identityKeyBytes
import info.signalboost.signalc.db.Identities.isTrusted
import info.signalboost.signalc.db.Identities.updatedAt
import info.signalboost.signalc.db.OwnIdentities
import info.signalboost.signalc.db.PreKeys
import info.signalboost.signalc.exception.SignalcError
import info.signalboost.signalc.util.KeyUtil
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.IdentityKeyStore
import java.time.Instant
import kotlin.jvm.Throws


class SignalcIdentityStore(
    val db: Database,
    val accountId: String,
    val lock: SessionLock,
    val resolveContactId: (String, String) -> Int,
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

    @Throws(SignalcError.UpdateToNonExistentFingerprint::class)
    fun trustFingerprint(address: SignalProtocolAddress, fingerprint: ByteArray) {
        lock.acquireForTransaction(db) {
            val contactId = resolveContactId(accountId, address.name)
            rejectUnknownFingerprint(contactId, fingerprint)
            Identities.updateByContactId(accountId, contactId) {
                it[isTrusted] = true
                it[updatedAt] = Instant.now()
            }
        }
    }

    @Throws(SignalcError.UpdateToNonExistentFingerprint::class)
    fun untrustFingerprint(address: SignalProtocolAddress, fingerprint: ByteArray) {
        lock.acquireForTransaction(db) {
            val contactId = resolveContactId(accountId, address.name)
            rejectUnknownFingerprint(contactId, fingerprint)
            Identities.updateByContactId(accountId, contactId) {
                it[isTrusted] = false
                it[updatedAt] = Instant.now()
            }
        }
    }

    private fun rejectUnknownFingerprint(contactId: Int, fingerprint: ByteArray) {
        transaction(db) {
            val knownFingerprint = Identities.findByContactId(accountId, contactId)?.let {
                it[identityKeyBytes]
            }
            if (!fingerprint.contentEquals(knownFingerprint))
                throw SignalcError.UpdateToNonExistentFingerprint(accountId, contactId, fingerprint)
        }
    }

    override fun saveIdentity(address: SignalProtocolAddress, identityKey: IdentityKey): Boolean =
        // Insert or update an idenity key and:
        // - trust the first identity key seen for a given address
        // - deny trust for subsequent identity keys for same address
        // Returns true if this save was an update to an existing record, false otherwise
        lock.acquireForTransaction(db) {
            val contactId = resolveContactId(accountId, address.name)
            Identities.findByContactId(accountId, contactId)
                ?.let { existingKey ->
                    Identities.updateByContactId(accountId, contactId) {
                        // store the new existingKey key in all cases
                        it[identityKeyBytes] = identityKey.serialize()
                        // only trust it if it matches the existing key
                        it[isTrusted] = existingKey[identityKeyBytes] contentEquals identityKey.serialize()
                        it[updatedAt] = Instant.now()
                    }
                    true
                } ?: run {
                Identities.insert {
                    it[accountId] = this@SignalcIdentityStore.accountId
                    it[Identities.contactId] = contactId
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
            Identities.findByContactId(accountId, resolveContactId(accountId, address.name))?.let {
                // it matches a key we have seen before
                it[identityKeyBytes] contentEquals identityKey.serialize() &&
                        // and we have not flagged it as untrusted
                        it[isTrusted]
            } ?: true // or it is the first key we ever seen for a person (TOFU!)
        }

    override fun getIdentity(address: SignalProtocolAddress): IdentityKey? =
        lock.acquireForTransaction(db) {
            Identities.findByContactId(accountId, resolveContactId(accountId, address.name))?.let {
                IdentityKey(it[identityKeyBytes], 0)
            }
        }

    fun removeIdentity(address: SignalProtocolAddress) {
        lock.acquireForTransaction(db) {
            Identities.deleteByContactId(accountId, resolveContactId(accountId, address.name))
        }
    }

    fun removeOwnIdentity() {
        lock.acquireForTransaction(db) {
            OwnIdentities.deleteWhere {
                OwnIdentities.accountId eq accountId
            }
        }
    }

    fun countIdentities(): Long =
        transaction(db) {
            Identities.selectAll().count()
        }


    fun whenIdentityLastUpdated(address: SignalProtocolAddress): Instant? =
        transaction(db) {
            Identities.findByContactId(accountId, resolveContactId(accountId, address.name))?.let {
                it[updatedAt]
            }
        }
}