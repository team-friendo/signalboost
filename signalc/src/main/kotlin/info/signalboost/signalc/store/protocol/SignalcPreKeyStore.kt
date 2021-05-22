package info.signalboost.signalc.store.protocol

import info.signalboost.signalc.db.PreKeys
import info.signalboost.signalc.serialization.ByteArrayEncoding.toPostgresHex
import org.jetbrains.exposed.sql.*
import org.whispersystems.libsignal.InvalidKeyException
import org.whispersystems.libsignal.state.PreKeyRecord
import org.whispersystems.libsignal.state.PreKeyStore


class SignalcPreKeyStore(
    val db: Database,
    val accountId: String,
    val lock: SessionLock,
): PreKeyStore {

    @Throws(InvalidKeyException::class)
    override fun loadPreKey(preKeyId: Int): PreKeyRecord =
        lock.acquireForTransaction(db) {
            PreKeys.select {
                PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
            }.singleOrNull()?.let {
                PreKeyRecord(it[PreKeys.preKeyBytes])
            } ?: throw InvalidKeyException()
        }

    fun getLastPreKeyId(): Int =
        lock.acquireForTransaction(db) {
            PreKeys
                .slice(PreKeys.preKeyId)
                .select { PreKeys.accountId eq accountId }
                .orderBy(PreKeys.preKeyId to SortOrder.DESC)
                .limit(1)
                .singleOrNull()?.let { it[PreKeys.preKeyId] } ?: 0
        }

    override fun storePreKey(preKeyId: Int, record: PreKeyRecord) {
        lock.acquireForTransaction(db) {
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

    fun storePreKeys(records: List<PreKeyRecord>) {
        lock.acquireForTransaction(db) {
            // we revert to raw SQL here b/c exposed's `batchInsert` helper does not
            // actually batch insert: https://github.com/JetBrains/Exposed/wiki/DSL#batch-insert
            exec("INSERT INTO prekeys (account_id, prekey_id, prekey_bytes) VALUES" +
                    records.joinToString(",\n") {
                        "('$accountId', '${it.id}', ${it.serialize().toPostgresHex()})"
                    } + ";"
            )
        }
    }

    override fun containsPreKey(preKeyId: Int): Boolean =
        lock.acquireForTransaction(db) {
            PreKeys.select {
                PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
            }.count() > 0
        }

    override fun removePreKey(preKeyId: Int) {
        lock.acquireForTransaction(db) {
            PreKeys.deleteWhere {
                PreKeys.accountId eq accountId and (PreKeys.preKeyId eq preKeyId)
            }
        }
    }

}