package info.signalboost.signalc.store.protocol

import info.signalboost.signalc.db.*
import info.signalboost.signalc.db.DeviceRecord.Companion.deleteByAddress
import info.signalboost.signalc.db.DeviceRecord.Companion.findByAddress
import info.signalboost.signalc.db.DeviceRecord.Companion.updateByAddress
import info.signalboost.signalc.db.Sessions.sessionBytes
import org.jetbrains.exposed.sql.*
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.protocol.CiphertextMessage
import org.whispersystems.libsignal.state.*
import org.whispersystems.signalservice.api.SignalServiceSessionStore

class SignalcSessionStore(
    val db: Database,
    val accountId: String,
    val lock: SessionLock,
): SignalServiceSessionStore {

    override fun loadSession(address: SignalProtocolAddress): SessionRecord =
        lock.acquireForTransaction(db) {
            Sessions.findByAddress(accountId, address)?.let {
                SessionRecord(it[sessionBytes])
            } ?: SessionRecord()
        }

    override fun getSubDeviceSessions(name: String): MutableList<Int> =
        lock.acquireForTransaction(db) {
            Sessions.select {
                Sessions.accountId eq accountId and (Sessions.contactId eq name)
            }.mapTo(mutableListOf()) { it[Sessions.deviceId] }
        }

    override fun storeSession(address: SignalProtocolAddress, record: SessionRecord) {
        // upsert the session record for a given address
        lock.acquireForTransaction(db) {
                Sessions.updateByAddress(accountId, address) {
                    it[sessionBytes] = record.serialize()
                }.let { numUpdated ->
                    if (numUpdated == 0) {
                        Sessions.insert {
                            it[accountId] = this@SignalcSessionStore.accountId
                            it[contactId] = address.name
                            it[deviceId] = address.deviceId
                            it[sessionBytes] = record.serialize()
                        }
                    }
                }
            }
        }

    override fun containsSession(address: SignalProtocolAddress): Boolean =
        lock.acquireForTransaction(db) {
            Sessions.findByAddress(accountId, address)?.let {
                val sessionRecord = SessionRecord(it[sessionBytes])
                sessionRecord.hasSenderChain()
                        && sessionRecord.sessionVersion == CiphertextMessage.CURRENT_VERSION;
            } ?: false
        }



    override fun deleteSession(address: SignalProtocolAddress) {
        lock.acquireForTransaction(db) {
            Sessions.deleteByAddress(accountId, address)
        }
    }


    override fun deleteAllSessions(name: String) {
        lock.acquireForTransaction(db) {
            Sessions.deleteWhere {
                Sessions.accountId eq accountId and (Sessions.contactId eq name)
            }
        }
    }

    override fun archiveSession(address: SignalProtocolAddress) {
        lock.acquireForTransaction(db) {
            Sessions.findByAddress(accountId, address)?.let {
                val session = SessionRecord(it[sessionBytes])
                session.archiveCurrentState()
                storeSession(address, session)
            }
        }
    }
}