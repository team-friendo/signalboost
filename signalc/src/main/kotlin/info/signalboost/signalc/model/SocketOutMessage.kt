package info.signalboost.signalc.model

import info.signalboost.signalc.util.SocketHashCode
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress

sealed class SocketOutMessage

data class Cleartext(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
    val body: String,
): SocketOutMessage()

data class CommandExecutionError(
    val command: String,
    val error: Throwable
): SocketOutMessage()

data class CommandInvalid(
    val command: String,
    val message: String,
): SocketOutMessage()

data class DecryptionError(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
    val error: Throwable,
): SocketOutMessage()

data class Dropped(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
    val envelope: SignalServiceEnvelope,
): SocketOutMessage()

data class Empty(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
): SocketOutMessage()

// TODO: flesh these out!
object SendSuccess: SocketOutMessage()
object SendFailure: SocketOutMessage()

object SubscribeSuccess: SocketOutMessage()
data class SubscribeFailure(
    val error: Throwable,
): SocketOutMessage()

data class Shutdown(
    val socketHash: SocketHashCode,
) : SocketOutMessage()