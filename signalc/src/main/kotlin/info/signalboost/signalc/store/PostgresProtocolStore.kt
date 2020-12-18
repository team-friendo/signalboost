package info.signalboost.signalc.store

import PreKeys
import info.signalboost.signalc.logic.KeyUtil
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.libsignal.IdentityKeyPair
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.state.*

class PostgresProtocolStore(private val db: Database): SignalProtocolStore {

    /********* PREKEYS *********/

    override fun loadPreKey(preKeyId: Int): PreKeyRecord {
        try {
            val preKeyBytes = transaction(db) {
                PreKeys.select {
                    PreKeys.id eq preKeyId
                }.single()[PreKeys.preKeyBytes]
            }
            return PreKeyRecord(preKeyBytes)
        } catch(e: NoSuchElementException) {
            throw InvalidKeyException()
        }
    }

    override fun storePreKey(preKeyId: Int, record: PreKeyRecord?) {
        transaction(db) {
            PreKeys.insert {
                it[id] = preKeyId
                it[preKeyBytes] = record?.serialize() ?: ByteArray(0)
            }
        }
    }

    override fun containsPreKey(preKeyId: Int): Boolean {
        return transaction(db) {
            PreKeys.select {
                PreKeys.id eq preKeyId
            }.count() > 0
        }
    }

    override fun removePreKey(preKeyId: Int) {
        transaction(db) {
            PreKeys.deleteWhere {
                PreKeys.id eq preKeyId
            }
        }
    }


    /********* SIGNED PREKEYS *********/

    override fun loadSignedPreKey(signedPreKeyId: Int): SignedPreKeyRecord {
        TODO("Not yet implemented")
    }

    override fun loadSignedPreKeys(): MutableList<SignedPreKeyRecord> {
        TODO("Not yet implemented")
    }

    override fun storeSignedPreKey(signedPreKeyId: Int, record: SignedPreKeyRecord?) {
        TODO("Not yet implemented")
    }

    override fun containsSignedPreKey(signedPreKeyId: Int): Boolean {
        TODO("Not yet implemented")
    }

    override fun removeSignedPreKey(signedPreKeyId: Int) {
        TODO("Not yet implemented")
    }


    /********* IDENTITIES *********/

    // TODO: store these!
    internal val ownIdentityKeypair = KeyUtil.genIdentityKeyPair()
    internal val ownLocalRegistrationId = KeyUtil.genRegistrationId()

    override fun getIdentityKeyPair(): IdentityKeyPair {
        TODO("Not yet implemented")
    }

    override fun getLocalRegistrationId(): Int {
        TODO("Not yet implemented")
    }

    override fun saveIdentity(address: SignalProtocolAddress?, identityKey: IdentityKey?): Boolean {
        TODO("Not yet implemented")
    }

    override fun isTrustedIdentity(
        address: SignalProtocolAddress?,
        identityKey: IdentityKey?,
        direction: IdentityKeyStore.Direction?
    ): Boolean {
        TODO("Not yet implemented")
    }

    override fun getIdentity(address: SignalProtocolAddress?): IdentityKey {
        TODO("Not yet implemented")
    }

    /********* SESSIONS *********/


    override fun loadSession(address: SignalProtocolAddress?): SessionRecord {
        TODO("Not yet implemented")
    }

    override fun getSubDeviceSessions(name: String?): MutableList<Int> {
        TODO("Not yet implemented")
    }

    override fun storeSession(address: SignalProtocolAddress?, record: SessionRecord?) {
        TODO("Not yet implemented")
    }

    override fun containsSession(address: SignalProtocolAddress?): Boolean {
        TODO("Not yet implemented")
    }

    override fun deleteSession(address: SignalProtocolAddress?) {
        TODO("Not yet implemented")
    }

    override fun deleteAllSessions(name: String?) {
        TODO("Not yet implemented")
    }

}