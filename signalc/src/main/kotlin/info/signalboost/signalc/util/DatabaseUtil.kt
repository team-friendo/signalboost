package info.signalboost.signalc.util

import com.zaxxer.hikari.HikariDataSource
import mu.KLogging

class DatabaseUtil(private val dataSource: HikariDataSource) {
    companion object: KLogging()

    fun vacuumDatabase() {
        try {
            logger.info { "Starting database vacuum process..." }
            dataSource.connection.use {
                it.autoCommit = true
                it.createStatement().execute(
                    "VACUUM accounts, ownidentities, identities, sessions, prekeys, signedprekeys;"
                )
                it.autoCommit = false
            }
            logger.info { "...database vacuum process complete, squeaky clean!" }
        } catch (e: Throwable) {
            logger.error { "Failed to vacuum database: ${e.stackTraceToString()}" }
            throw e
        }
    }
}