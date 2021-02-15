package info.signalboost.signalc.testSupport.matchers

import info.signalboost.signalc.model.*
import info.signalboost.signalc.util.SocketHashCode
import io.mockk.MockKMatcherScope
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress

object SocketOutMessageMatchers {

    fun MockKMatcherScope.cleartext(
        sender: SignalServiceAddress,
        recipient: SignalServiceAddress,
        body: String,
    ): Cleartext = match {
        it.sender == sender &&
            it.recipient == recipient &&
            it.body == body
    }

    fun MockKMatcherScope.commandExecutionException(
        error: Throwable,
        command: SocketRequest,
    ): CommandExecutionException = match {
        it.command == command &&
            it.cause.javaClass == error.javaClass &&
            it.cause.message == error.message
    }


    fun MockKMatcherScope.decryptionError(
        sender: SignalServiceAddress,
        recipient: SignalServiceAddress,
        error: Throwable
    ): DecryptionError = match {
        it.sender == sender &&
            it.recipient == recipient &&
            it.error == error
    }

    fun MockKMatcherScope.dropped(
        sender: SignalServiceAddress,
        recipient: SignalServiceAddress,
        envelope: SignalServiceEnvelope,
    ): Dropped = match {
        it.sender == sender &&
            it.recipient == recipient &&
            it.envelope == envelope
    }

    fun MockKMatcherScope.shutdown(
        socketHash: SocketHashCode,
    ): Shutdown = match {
        it.socketHash == socketHash
    }
}