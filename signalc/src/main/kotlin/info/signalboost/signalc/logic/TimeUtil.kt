package info.signalboost.signalc.logic

import java.time.Instant

object TimeUtil {
    fun nowInMillis(): Long = Instant.now().toEpochMilli()
}