package info.signalboost.signalc.store.protocol


import info.signalboost.signalc.db.SenderKeys
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.groups.state.SenderKeyRecord
import org.whispersystems.libsignal.groups.state.SenderKeyStore
import org.whispersystems.signalservice.api.SignalSessionLock
import java.util.UUID


class SignalcSenderKeyStore(
    val db: Database,
    val accountId: String,
    val lock: SignalSessionLock,
    ): SenderKeyStore {

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
            it[accountId] = this@SignalcSenderKeyStore.accountId
            it[name] = sender.name
            it[deviceId] = sender.deviceId
            it[this.distributionId] = distributionId
            it[senderKeyBytes] = SenderKeyRecord().serialize()
        }.resultedValues!![0]
}