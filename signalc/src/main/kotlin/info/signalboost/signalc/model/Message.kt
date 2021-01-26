package info.signalboost.signalc.model

import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress

sealed class Message

data class EmptyMessage(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
): Message()

data class Cleartext(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
    val body: String,
): Message()

data class DecryptionError(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
    val error: Exception,
): Message()

data class DroppedMessage(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
    val envelope: SignalServiceEnvelope,
): Message()