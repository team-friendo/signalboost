package info.signalboost.signalc.store.protocol

import info.signalboost.signalc.db.*
import info.signalboost.signalc.dispatchers.Concurrency
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.state.*
import org.whispersystems.signalservice.api.SignalSessionLock


class SignalcPreKeyStore(
    val db: Database,
    val accountId: String,
    val lock: SignalSessionLock,
): PreKeyStore {

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
                            it[accountId] = this@SignalcPreKeyStore.accountId
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

}