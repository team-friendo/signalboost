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

    fun MockKMatcherScope.commandExecutionError(
        command: String,
        error: Throwable,
    ): CommandExecutionError = match {
        it.command == command &&
            it.error.javaClass == error.javaClass &&
            it.error.message == error.message
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

    fun MockKMatcherScope.empty(
        sender: SignalServiceAddress,
        recipient: SignalServiceAddress,
    ): Empty = match {
        it.sender == sender &&
            it.recipient == recipient
    }

    fun MockKMatcherScope.shutdown(
        socketHash: SocketHashCode,
    ): Shutdown = match {
        it.socketHash == socketHash
    }
}