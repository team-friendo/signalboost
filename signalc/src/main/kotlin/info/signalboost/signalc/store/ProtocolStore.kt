package info.signalboost.signalc.store


import info.signalboost.signalc.db.*
import info.signalboost.signalc.db.AccountWithAddress.Companion.deleteByAddress
import info.signalboost.signalc.db.AccountWithAddress.Companion.findByAddress
import info.signalboost.signalc.db.AccountWithAddress.Companion.updateByAddress
import info.signalboost.signalc.db.Identities.identityKeyBytes
import info.signalboost.signalc.db.Identities.isTrusted
import info.signalboost.signalc.db.Sessions.sessionBytes
import info.signalboost.signalc.logic.KeyUtil
import info.signalboost.signalc.model.Account
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.*

class ProtocolStore(private val db: Database) {
    fun of(account: Account): SignalProtocolStore = AccountProtocolStore(db, account.username)

    class AccountProtocolStore(
        private val db: Database,
        private val accountId: String,
    ): SignalProtocolStore {

        /********* IDENTITIES *********/

        override fun getIdentityKeyPair(): IdentityKeyPair =
            transaction(db) {
                OwnIdentities.select {
                    OwnIdentities.accountId eq accountId
                }.singleOrNull() ?: createOwnIdentity()
            }.let {
                IdentityKeyPair(it[OwnIdentities.keyPairBytes])
            }

        override fun getLocalRegistrationId(): Int =
            transaction(db) {
                OwnIdentities.select {
                    OwnIdentities.accountId eq accountId
                }.singleOrNull() ?: createOwnIdentity()
            }[OwnIdentities.registrationId]

        private fun createOwnIdentity(): ResultRow =
            transaction(db) {
                OwnIdentities.insert {
                    it[PreKeys.accountId] = this@AccountProtocolStore.accountId
                    it[keyPairBytes] = KeyUtil.genIdentityKeyPair().serialize()
                    it[registrationId] = KeyUtil.genRegistrationId()
                }.resultedValues!![0]
            }

        override fun saveIdentity(address: SignalProtocolAddress, identityKey: IdentityKey): Boolean =
        // Insert or update an idenity key and:
        // - trust the first identity key seen for a given address
        // - deny trust for subsequent identity keys for same address
            // Return whether or not this save was an update to an existing record.
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

        override fun isTrustedIdentity(
            address: SignalProtocolAddress,
            identityKey: IdentityKey,
            direction: IdentityKeyStore.Direction
        ): Boolean = transaction(db) {
            // trust a key if...
            Identities.findByAddress(accountId, address)?.let{
                // it matches a key we have seen before
                it[identityKeyBytes] contentEquals  identityKey.serialize() &&
                    // and we have not flagged it as untrusted
                    it[isTrusted]
            } ?: true // or it is the first key we ever seen for a person (TOFU!)
        }

        override fun getIdentity(address: SignalProtocolAddress): IdentityKey? =
            transaction(db) {
                Identities.findByAddress(accountId, address)?.let{
                    IdentityKey(it[Identities.identityKeyBytes], 0) }
            }

        fun removeIdentity(address: SignalProtocolAddress) {
            transaction(db) {
                Identities.deleteByAddress(accountId, address)
            }
        }

        fun removeOwnIdentity() {
            transaction(db) {
                OwnIdentities.deleteWhere {
                    OwnIdentities.accountId eq accountId
                }
            }
        }

        /********* PREKEYS *********/

        override fun loadPreKey(preKeyId: Int): PreKeyRecord =
            transaction(db) {
                PreKeys.select {
                    PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
                }.singleOrNull()?.let {
                    PreKeyRecord(it[PreKeys.preKeyBytes])
                } ?: throw InvalidKeyException()
            }


        override fun storePreKey(preKeyId: Int, record: PreKeyRecord) {
            transaction(db) {
                PreKeys.update({
                    PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
                }) {
                    it[preKeyBytes] = record.serialize()
                }.let { numUpdated ->
                    if(numUpdated == 0) {
                        PreKeys.insert {
                            it[accountId] = this@AccountProtocolStore.accountId
                            it[this.preKeyId] = preKeyId
                            it[preKeyBytes] = record.serialize()
                        }
                    }
                }
            }
        }

        override fun containsPreKey(preKeyId: Int): Boolean =
            transaction(db) {
                PreKeys.select {
                    PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
                }.count() > 0
            }


        override fun removePreKey(preKeyId: Int) {
            transaction(db) {
                PreKeys.deleteWhere {
                    PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
                }
            }
        }


        /********* SIGNED PREKEYS *********/

        override fun loadSignedPreKey(signedPreKeyId: Int): SignedPreKeyRecord =
            transaction(db) {
                SignedPreKeys.select {
                    SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
                }.singleOrNull()?.get(SignedPreKeys.signedPreKeyBytes)
            }?.let { SignedPreKeyRecord(it) } ?: throw InvalidKeyException()

        override fun loadSignedPreKeys(): MutableList<SignedPreKeyRecord> =
            transaction(db) {
                SignedPreKeys.selectAll().map {
                    it[SignedPreKeys.signedPreKeyBytes]
                }
            }.mapTo(mutableListOf()) { SignedPreKeyRecord(it) }


        override fun storeSignedPreKey(signedPreKeyId: Int, record: SignedPreKeyRecord) {
            transaction(db) {
                SignedPreKeys.update ({
                    SignedPreKeys.accountId eq accountId and (
                        SignedPreKeys.preKeyId eq signedPreKeyId
                        )
                }) {
                    it[signedPreKeyBytes] = record.serialize()
                }.let{ numUpdated ->
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

        override fun containsSignedPreKey(signedPreKeyId: Int): Boolean =
            transaction(db) {
                SignedPreKeys.select {
                    SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
                }.singleOrNull()?.let { true } ?: false
            }

        override fun removeSignedPreKey(signedPreKeyId: Int) {
            transaction(db) {
                SignedPreKeys.deleteWhere {
                    SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
                }
            }
        }

        /********* SESSIONS *********/

        override fun loadSession(address: SignalProtocolAddress): SessionRecord =
            transaction(db) {
                Sessions.findByAddress(accountId, address)?.let {
                    SessionRecord(it[Sessions.sessionBytes])
                } ?: SessionRecord()
            }

        override fun getSubDeviceSessions(name: String): MutableList<Int> {
            return transaction(db) {
                Sessions.select{
                    Sessions.accountId eq accountId and (Sessions.name eq name)
                }.mapTo(mutableListOf()) { it[Sessions.deviceId] }
            }
        }

        override fun storeSession(address: SignalProtocolAddress, record: SessionRecord) {
            // upsert the session record for a given address
            transaction(db) {
                Sessions.updateByAddress(accountId, address) {
                    it[sessionBytes] = record.serialize()
                }.let { numUpdated ->
                    if(numUpdated == 0) {
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

        override fun containsSession(address: SignalProtocolAddress): Boolean =
            transaction(db) {
                Sessions.findByAddress(accountId, address)?.let { true } ?: false
            }


        override fun deleteSession(address: SignalProtocolAddress) {
            transaction(db) {
                Sessions.deleteByAddress(accountId, address)
            }
        }

        override fun deleteAllSessions(name: String) {
            transaction(db) {
                Sessions.deleteWhere {
                    Sessions.accountId eq accountId and (Sessions.name eq name)
                }
            }
        }
    }
}
