package info.signalboost.signalc.store

import info.signalboost.signalc.db.Envelopes
import info.signalboost.signalc.serialization.EnvelopeSerializer.toByteArray
import info.signalboost.signalc.serialization.EnvelopeSerializer.toEnvelope
import kotlinx.coroutines.Dispatchers.IO
import mu.KLoggable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import java.util.UUID

class EnvelopeStore(val db: Database) {
    companion object: KLoggable {
        override val logger = logger()
    }

    // NOTE: #create must be blocking b/c it is passed as a callback to libsignal
    fun create(accountId: String, envelope: SignalServiceEnvelope): UUID =
        transaction(db) {
            Envelopes.insertAndGetId {
                it[this.accountId] = accountId
                it[this.envelopeBytes] = envelope.toByteArray()
                it[this.serverDeliveredTimestamp] = envelope.serverDeliveredTimestamp
            }.value
        }

    suspend fun delete(cacheId: UUID): Unit = newSuspendedTransaction(IO, db) {
        Envelopes.deleteWhere {
            Envelopes.id eq cacheId
        }
    }

    suspend fun findAll(accountId: String): List<SignalServiceEnvelope> =
        newSuspendedTransaction(IO, db) {
            Envelopes.select {
                Envelopes.accountId eq accountId
            }.map { it.toEnvelope() }
        }

    // testing helpers

    internal suspend fun clear(): Unit = newSuspendedTransaction(IO, db) {
        Envelopes.deleteAll()
    }

    internal suspend fun count(): Long = newSuspendedTransaction(IO, db) {
        Envelopes.selectAll().count()
    }
}