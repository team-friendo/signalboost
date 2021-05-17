package info.signalboost.signalc.store


import info.signalboost.signalc.db.*
import info.signalboost.signalc.db.AccountWithAddress.Companion.deleteByAddress
import info.signalboost.signalc.db.AccountWithAddress.Companion.findByAddress
import info.signalboost.signalc.db.Identities.identityKeyBytes
import info.signalboost.signalc.db.Identities.name
import info.signalboost.signalc.util.KeyUtil
import info.signalboost.signalc.model.Account
import io.lettuce.core.api.sync.RedisCommands
import mu.KLoggable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.protocol.CiphertextMessage
import org.whispersystems.libsignal.state.*
import org.whispersystems.libsignal.util.Hex
import org.whispersystems.signalservice.api.SignalServiceProtocolStore
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.*

class ProtocolStore constructor(private val db: Database, private val cache: RedisCommands<String, String>) {
    fun of(account: Account): AccountProtocolStore = AccountProtocolStore(db, account.username, cache)

    fun countOwnIdentities(): Long =
        transaction(db) { OwnIdentities.selectAll().count() }

    class AccountProtocolStore(
        private val db: Database,
        private val accountId: String,
        private val cache: RedisCommands<String, String>
    ): SignalServiceProtocolStore {

        companion object: Any(), KLoggable {
            override val logger = logger()
        }

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

        fun saveFingerprintForAllIdentities(address: SignalServiceAddress, fingerprint: ByteArray) =
            transaction(db) {
                Identities.update({
                    (name eq address.identifier)
                        .and(Identities.accountId eq this@AccountProtocolStore.accountId)
                }) {
                    it[identityKeyBytes] = fingerprint
                }
            }

        fun trustFingerprintForAllIdentities(fingerprint: ByteArray) =
            transaction(db) {
                Identities.update({ identityKeyBytes eq fingerprint }) {
                    it[isTrusted] = true
                }
            }

        private fun cacheName(): String = System.getenv("SIGNALC_CACHE_NAME")

        private fun hashIdentityKey(accountId: String, address: SignalProtocolAddress): String {
            return "${cacheName()}-identity-$accountId-${address.name}-${address.deviceId}"
        }

        private fun hashIdentityValue(identityKey: IdentityKey, isTrusted: Boolean): String {
            val encodedIdentityKey = Hex.toHexString(identityKey.serialize())
            val encodedIsTrusted = if(isTrusted) "t" else "f"
            return "${encodedIdentityKey}-${encodedIsTrusted}"
        }

        private fun parseIdentityValue(value: String): Pair<ByteArray, Boolean> {
            val values = value.split("-")
            val decodedIdentityKey = Hex.fromStringCondensed(values[0])
            val decodedIsTrusted = "t" == values[1]
            return Pair(decodedIdentityKey, decodedIsTrusted)
        }

        override fun saveIdentity(address: SignalProtocolAddress, identityKey: IdentityKey): Boolean {
            // Insert or update an idenity key and:
            // - trust the first identity key seen for a given address
            // - deny trust for subsequent identity keys for same address
            // Returns true if this save was an update to an existing record, false otherwise

            logger.info { "saveIdentity for $accountId:${address.name}" }

            cache.get(hashIdentityKey(accountId, address))?.let {
                val (cachedKey, _) = parseIdentityValue(it)
                val shouldTrust = cachedKey contentEquals identityKey.serialize()
                cache.set(hashIdentityKey(accountId, address), hashIdentityValue(identityKey, shouldTrust))
                return true
            }
            cache.set(hashIdentityKey(accountId, address), hashIdentityValue(identityKey, true))
            return false
        }

        override fun isTrustedIdentity(
            address: SignalProtocolAddress,
            identityKey: IdentityKey,
            direction: IdentityKeyStore.Direction
        ): Boolean {
            logger.info { "isTrustedIdentity for $accountId:${address.name}" }

            // trust a key if...
            cache.get(hashIdentityKey(accountId, address))?.let {
                val (cachedKey, cachedIsTrusted) = parseIdentityValue(it)
                // it matches a key we have seen before and we have not flagged it as untrusted
                return cachedKey contentEquals identityKey.serialize() && cachedIsTrusted
            }
            // or it is the first key we ever seen for a person (TOFU!)
            return true
        }

        override fun getIdentity(address: SignalProtocolAddress): IdentityKey? {
            logger.info { "getIdentity for $accountId:${address.name}" }
            return transaction(db) {
                Identities.findByAddress(accountId, address)?.let{
                    IdentityKey(it[identityKeyBytes], 0) }
            }
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

        private fun hashSessionKey(accountId: String, address: SignalProtocolAddress): String {
            return "${cacheName()}-session-$accountId-${address.name}-${address.deviceId}"
        }

        override fun loadSession(address: SignalProtocolAddress): SessionRecord {
            logger.info { "loadSession for $accountId:${address.name}" }
            cache.get(hashSessionKey(accountId, address))?.let {
                return SessionRecord(Base64.getDecoder().decode(it))
            }
            return SessionRecord()
        }

        override fun getSubDeviceSessions(name: String): MutableList<Int> {
            logger.info { "getSubDeviceSessions for $accountId:$name" }
            return transaction(db) {
                Sessions.select{
                    Sessions.accountId eq accountId and (Sessions.name eq name)
                }.mapTo(mutableListOf()) { it[Sessions.deviceId] }
            }
        }

        override fun storeSession(address: SignalProtocolAddress, record: SessionRecord) {
            logger.info { "storeSession for $accountId:${address.name}" }
            cache.set(hashSessionKey(accountId, address), Base64.getEncoder().encodeToString(record.serialize()))
        }

        override fun containsSession(address: SignalProtocolAddress): Boolean {
            logger.info { "containsSession for $accountId:${address.name}" }
            cache.get(hashSessionKey(accountId, address))?.let {
                val sessionRecord = SessionRecord(Base64.getDecoder().decode(it))
                return sessionRecord.hasSenderChain()
                        && sessionRecord.sessionVersion == CiphertextMessage.CURRENT_VERSION
            }
            return false
        }

        override fun deleteSession(address: SignalProtocolAddress) {
            logger.info { "deleteSession for $accountId:${address.name}" }
            transaction(db) {
                Sessions.deleteByAddress(accountId, address)
            }
        }

        override fun deleteAllSessions(name: String) {
            logger.info { "deleteAllSessions for $accountId:${name}" }
            transaction(db) {
                Sessions.deleteWhere {
                    Sessions.accountId eq accountId and (Sessions.name eq name)
                }
            }
        }

        override fun archiveSession(address: SignalProtocolAddress) {
            logger.info { "archiveSession for $accountId:${address.name}" }
            transaction(db) {
                loadSession(address).let {
                    it.archiveCurrentState()
                    storeSession(address, it)
                }
            }
        }
    }
}
