package info.signalboost.signalc.logic

import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicInteger
import kotlin.time.Duration
import kotlin.time.ExperimentalTime
import kotlin.time.TimeSource

@ExperimentalTime
object MessageQueue {
    /******
     * attempt to drain a queue of in-flight messages before a timeout is reached
     *
     * return tuple indicating:
     * - if drain completed (true if yes)
     * - number of messages attempted to drain
     * - number of undrained messages remaining at completion
     *****/
    suspend fun drain(messagesInFlight: AtomicInteger, timeout: Duration, pollInterval: Duration): Triple<Boolean,Int,Int> {
        val numToDrain = messagesInFlight.get()
        val end = TimeSource.Monotonic.markNow().plus(timeout)
        while(true) {
            if(end.hasPassedNow()) return Triple(false, numToDrain, messagesInFlight.get())
            if(messagesInFlight.get() == 0) return Triple(true, numToDrain, 0)
            delay(pollInterval)
        }
    }
}