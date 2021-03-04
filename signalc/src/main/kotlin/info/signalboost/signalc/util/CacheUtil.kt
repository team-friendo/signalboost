package info.signalboost.signalc.util

import java.util.concurrent.ConcurrentHashMap

object CacheUtil {
    fun <T> getMemoized(
        cache: ConcurrentHashMap<String, T>,
        key: String,
        create: () -> T
    ): T = cache[key] ?: create().also { cache[key] = it }

}