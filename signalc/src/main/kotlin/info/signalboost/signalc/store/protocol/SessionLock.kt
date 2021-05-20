package info.signalboost.signalc.store.protocol

import org.whispersystems.signalservice.api.SignalSessionLock
import java.util.concurrent.locks.ReentrantLock

class SessionLock(): SignalSessionLock {
    private val lock = ReentrantLock()

    override fun acquire(): SignalSessionLock.Lock {
        lock.lock()
        return SignalSessionLock.Lock { lock.unlock() }
    }
}