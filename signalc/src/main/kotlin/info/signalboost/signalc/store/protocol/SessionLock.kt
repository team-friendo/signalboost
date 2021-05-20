package info.signalboost.signalc.store.protocol

import kotlinx.coroutines.CoroutineDispatcher
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.Transaction
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.signalservice.api.SignalSessionLock
import java.util.concurrent.locks.ReentrantLock

class SessionLock : SignalSessionLock {
    private val lock = ReentrantLock()

    override fun acquire(): SignalSessionLock.Lock {
        lock.lock()
        return SignalSessionLock.Lock { lock.unlock() }
    }

    fun <T>acquireForTransaction(db: Database, statement: Transaction.() -> T) =
        this.acquire().use{ _ ->
            transaction(db) {
                statement()
            }
        }

    suspend fun <T>acquireForSuspendTransaction(
        dispatcher: CoroutineDispatcher,
        db: Database, statement:
        Transaction.() -> T
    ) =
        this.acquire().use{ _ ->
            newSuspendedTransaction(dispatcher, db) {
                statement()
            }
        }
}