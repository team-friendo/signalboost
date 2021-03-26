package info.signalboost.signalc.logging

import mu.KLoggable
import org.whispersystems.libsignal.logging.SignalProtocolLogger
import org.whispersystems.libsignal.logging.SignalProtocolLoggerProvider

object LibSignalLogger: SignalProtocolLogger, KLoggable {
    override val logger = logger()
    private val excludedTags = setOf("WebSocket", "WebSocketConnection")

    fun init() = SignalProtocolLoggerProvider.setProvider(LibSignalLogger)

    override fun log(priority: Int, tag: String, message: String) {
        if (excludedTags.contains(tag)) return
        "[$tag]: $message".let {
            when (priority) {
                SignalProtocolLogger.VERBOSE -> logger.trace(it)
                SignalProtocolLogger.DEBUG -> logger.debug(it)
                SignalProtocolLogger.INFO -> logger.info(it)
                SignalProtocolLogger.WARN -> logger.warn(it)
                SignalProtocolLogger.ERROR, SignalProtocolLogger.ASSERT -> logger.error(it)
            }
        }
    }
}