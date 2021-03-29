package info.signalboost.signalc.metrics

import mu.KLogger
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.Transaction
import org.jetbrains.exposed.sql.transactions.transaction
import kotlin.system.measureTimeMillis

object MetricsUtil {
    fun <T> timedTransaction(
        db: Database? = null,
        logger: KLogger,
        label: String,
        statement: Transaction.() -> T,
    ): T {
        var res: T
        val elapsed = measureTimeMillis {
            res = transaction(db) {
                statement()
            }
        }
        logger.debug("$elapsed:  $label")
        return res
    }

    fun <T> withTimedMillis(
        block: () -> T,
    ): Pair<T,Long> {
        var res: T
        val elapsed = measureTimeMillis {
            res = block()
        }
        return Pair(res, elapsed)
    }
}