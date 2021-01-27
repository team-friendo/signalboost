package info.signalboost.signalc.util

import java.time.Instant

object TimeUtil {
    fun nowInMillis(): Long = Instant.now().toEpochMilli()
}