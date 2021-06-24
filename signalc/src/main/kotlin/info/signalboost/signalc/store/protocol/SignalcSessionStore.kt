package info.signalboost.signalc.store.protocol

import info.signalboost.signalc.db.*
import info.signalboost.signalc.db.ContactRecord.Companion.deleteByContactId
import info.signalboost.signalc.db.ContactRecord.Companion.findManyByContactId
import info.signalboost.signalc.db.DeviceRecord.Companion.deleteByDeviceId
import info.signalboost.signalc.db.DeviceRecord.Companion.findByDeviceId
import info.signalboost.signalc.db.DeviceRecord.Companion.updateByDeviceId
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
    val resolveContactId: (String, String) -> Int,
): SignalServiceSessionStore {

    override fun loadSession(address: SignalProtocolAddress): SessionRecord =
        lock.acquireForTransaction(db) {
            val contactId = resolveContactId(accountId, address.name)
            Sessions.findByDeviceId(accountId, contactId, address.deviceId)?.let {
                SessionRecord(it[sessionBytes])
            } ?: SessionRecord()
        }

    override fun getSubDeviceSessions(name: String): MutableList<Int> =
        lock.acquireForTransaction(db) {
            Sessions.select {
                (Sessions.accountId eq accountId).and(Sessions.contactId eq resolveContactId(accountId, name))
            }.mapTo(mutableListOf()) { it[Sessions.deviceId] }
        }

    override fun storeSession(address: SignalProtocolAddress, record: SessionRecord) {
        // upsert the session record for a given address
        lock.acquireForTransaction(db) {
            val contactId = resolveContactId(accountId, address.name)
            Sessions.updateByDeviceId(accountId, contactId, address.deviceId) {
                it[sessionBytes] = record.serialize()
            }.let { numUpdated ->
                if (numUpdated == 0) {
                    Sessions.insert {
                        it[accountId] = this@SignalcSessionStore.accountId
                        it[Sessions.contactId] = contactId
                        it[deviceId] = address.deviceId
                        it[sessionBytes] = record.serialize()
                    }
                }
            }
        }
    }

    override fun containsSession(address: SignalProtocolAddress): Boolean =
        lock.acquireForTransaction(db) {
            val contactId = resolveContactId(accountId, address.name)
            Sessions.findByDeviceId(accountId, contactId, address.deviceId)?.let {
                val sessionRecord = SessionRecord(it[sessionBytes])
                sessionRecord.hasSenderChain() && sessionRecord.sessionVersion == CiphertextMessage.CURRENT_VERSION
            } ?: false
        }



    override fun deleteSession(address: SignalProtocolAddress) {
        lock.acquireForTransaction(db) {
            val contactId = resolveContactId(accountId, address.name)
            Sessions.deleteByDeviceId(accountId, contactId, address.deviceId)
        }
    }


    override fun deleteAllSessions(name: String) {
        lock.acquireForTransaction(db) {
            Sessions.deleteByContactId(accountId, resolveContactId(accountId, name))
        }
    }

    override fun archiveSession(address: SignalProtocolAddress) {
        lock.acquireForTransaction(db) {
            val contactId = resolveContactId(accountId, address.name)
            Sessions.findByDeviceId(accountId, contactId, address.deviceId)?.let {
                val session = SessionRecord(it[sessionBytes])
                session.archiveCurrentState()
                storeSession(address, session)
            }
        }
    }

    fun archiveAllSessions(address: SignalProtocolAddress) {
        lock.acquireForTransaction(db) {
            val contactId = resolveContactId(accountId, address.name)
            Sessions.findManyByContactId(accountId, contactId).forEach {
                val session = SessionRecord(it[sessionBytes])
                session.archiveCurrentState()
                storeSession(address, session)
            }
        }
    }
}