package info.signalboost.signalc.logging

import mu.KLoggable
import org.whispersystems.libsignal.logging.SignalProtocolLogger
import org.whispersystems.libsignal.logging.SignalProtocolLoggerProvider

object LibSignalLogger: SignalProtocolLogger, KLoggable {
    override val logger = logger()
    fun init() = SignalProtocolLoggerProvider.setProvider(LibSignalLogger)

    override fun log(priority: Int, tag: String, message: String) {
        val logMessage = "[$tag]: $message"
        when (priority) {
            SignalProtocolLogger.VERBOSE -> logger.trace(logMessage)
            SignalProtocolLogger.DEBUG -> logger.debug(logMessage)
            SignalProtocolLogger.INFO -> logger.info(logMessage)
            SignalProtocolLogger.WARN -> logger.warn(logMessage)
            SignalProtocolLogger.ERROR, SignalProtocolLogger.ASSERT -> logger.error(logMessage)
        }
    }
}