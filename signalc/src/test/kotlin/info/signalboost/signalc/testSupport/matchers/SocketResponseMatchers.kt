package info.signalboost.signalc.testSupport.matchers

import info.signalboost.signalc.model.*
import info.signalboost.signalc.util.SocketHashCode
import io.kotest.matchers.Matcher
import io.kotest.matchers.MatcherResult
import io.kotest.matchers.should
import io.kotest.matchers.shouldNot
import io.mockk.MockKMatcherScope
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

object SocketResponseMatchers {

    fun MockKMatcherScope.cleartext(
        sender: SocketAddress,
        recipient: SocketAddress,
        body: String,
    ): SocketResponse.Cleartext = match {
        it.sender == sender &&
            it.recipient == recipient &&
            it.body == body
    }

    fun MockKMatcherScope.commandExecutionException(
        error: Throwable,
        command: SocketRequest,
    ): SocketResponse.RequestHandlingException = match {
        it.request == command &&
            it.error.javaClass == error.javaClass &&
            it.error.message == error.message
    }


    fun MockKMatcherScope.decryptionError(
        sender: SocketAddress,
        recipient: SocketAddress,
        cause: Throwable
    ): SocketResponse.DecryptionException = match {
        it.sender == sender &&
            it.recipient == recipient &&
            it.error == cause
    }

    fun MockKMatcherScope.dropped(
        sender: SocketAddress,
        recipient: SocketAddress,
        envelope: SignalServiceEnvelope,
    ): SocketResponse.Dropped = match {
        it.sender == sender &&
            it.recipient == recipient &&
            it.envelope == envelope
    }

    fun MockKMatcherScope.shutdown(
        socketHash: SocketHashCode,
    ): SocketResponse.Shutdown = match {
        it.socketHash == socketHash
    }

    fun MockKMatcherScope.shouldBeLike(
        other: SocketResponse.RequestHandlingException,
    ): SocketResponse.RequestHandlingException = match {
        it.error.message == other.error.message &&
        it.request == other.request
    }

    fun throwLike(other: SocketResponse.RequestHandlingException) = object:
        Matcher<SocketResponse.RequestHandlingException> {
        override fun test(value: SocketResponse.RequestHandlingException) = MatcherResult(
            value.error.message == other.error.message && value.request == other.request,
            "Request $value should have same error message and request as $other",
            "Request $value should not have same error message and request as $other",
        )
    }

    fun SocketResponse.RequestHandlingException.shouldThrowLike(other: SocketResponse.RequestHandlingException) =
        this should throwLike(other)

    fun SocketResponse.RequestHandlingException.shouldNotThrowLike(other: SocketResponse.RequestHandlingException) =
        this shouldNot throwLike(other)
}