package info.signalboost.signalc.store.protocol

import info.signalboost.signalc.db.SignedPreKeys
import org.jetbrains.exposed.exceptions.ExposedSQLException
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.transactions.transactionManager
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.state.SignedPreKeyRecord
import org.whispersystems.libsignal.state.SignedPreKeyStore


class SignalcSignedPreKeyStore(
    val db: Database,
    val accountId: String,
    val lock: SessionLock,
): SignedPreKeyStore {

    fun getLastPreKeyId(): Int =
        lock.acquireForTransaction(db) {
            SignedPreKeys
                .slice(SignedPreKeys.preKeyId)
                .select { SignedPreKeys.accountId eq accountId }
                .orderBy(SignedPreKeys.preKeyId to SortOrder.DESC)
                .limit(1)
                .singleOrNull()?.let { it[SignedPreKeys.preKeyId] } ?: 0
        }

    override fun loadSignedPreKey(signedPreKeyId: Int): SignedPreKeyRecord =
        lock.acquireForTransaction(db) {
            SignedPreKeys.select {
                SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
            }.singleOrNull()?.get(SignedPreKeys.signedPreKeyBytes)
        }?.let { SignedPreKeyRecord(it) } ?: throw InvalidKeyException()

    override fun loadSignedPreKeys(): MutableList<SignedPreKeyRecord> =
        lock.acquireForTransaction(db) {
            SignedPreKeys.selectAll().map {
                it[SignedPreKeys.signedPreKeyBytes]
            }
        }.mapTo(mutableListOf()) { SignedPreKeyRecord(it) }

    override fun storeSignedPreKey(signedPreKeyId: Int, record: SignedPreKeyRecord) {
        lock.acquire().use { _ ->
            try {
                transaction(db.transactionManager.defaultIsolationLevel, 0, db) {
                    SignedPreKeys.insert {
                        it[accountId] = this@SignalcSignedPreKeyStore.accountId
                        it[preKeyId] = signedPreKeyId
                        it[signedPreKeyBytes] = record.serialize()
                    }
                }
            } catch (ignored: ExposedSQLException) {
                transaction(db) {
                    SignedPreKeys.update({
                        SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
                    }) {
                        it[signedPreKeyBytes] = record.serialize()
                    }
                }
            }
        }
    }

    override fun containsSignedPreKey(signedPreKeyId: Int): Boolean =
        lock.acquireForTransaction(db) {
            SignedPreKeys.select {
                SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
            }.singleOrNull()?.let { true } ?: false
        }


    override fun removeSignedPreKey(signedPreKeyId: Int) {
        lock.acquireForTransaction(db) {
            SignedPreKeys.deleteWhere {
                SignedPreKeys.accountId eq accountId and (SignedPreKeys.preKeyId eq signedPreKeyId)
            }
        }
    }

}