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
        sender: SerializableAddress,
        recipient: SerializableAddress,
        body: String,
    ): SocketResponse.Cleartext = match {
        it.data.source == sender &&
            it.data.username == recipient.number &&
            it.data.dataMessage.body == body
    }

    fun MockKMatcherScope.requestHandlingError(
        error: Throwable,
        command: SocketRequest,
    ): SocketResponse.RequestHandlingErrorLegacy = match {
        it.request == command &&
            it.error.javaClass == error.javaClass &&
            it.error.message == error.message
    }

    fun MockKMatcherScope.subscriptionFailed(
        error: Throwable,
    ): SocketResponse.SubscriptionFailedLegacy = match {
        it.error.javaClass == error.javaClass && it.error.message == error.message
    }


    fun MockKMatcherScope.decryptionError(
        sender: SerializableAddress,
        recipient: SerializableAddress,
        cause: Throwable
    ): SocketResponse.DecryptionError = match {
        it.sender == sender &&
            it.recipient == recipient &&
            it.error == cause
    }

    fun MockKMatcherScope.dropped(
        sender: SerializableAddress,
        recipient: SerializableAddress,
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
        other: SocketResponse.RequestHandlingErrorLegacy,
    ): SocketResponse.RequestHandlingErrorLegacy = match {
        it.error.message == other.error.message &&
        it.request == other.request
    }

    fun throwLike(other: SocketResponse.RequestHandlingErrorLegacy) = object:
        Matcher<SocketResponse.RequestHandlingErrorLegacy> {
        override fun test(value: SocketResponse.RequestHandlingErrorLegacy) = MatcherResult(
            value.error.message == other.error.message && value.request == other.request,
            "Request $value should have same error message and request as $other",
            "Request $value should not have same error message and request as $other",
        )
    }

    fun SocketResponse.RequestHandlingErrorLegacy.shouldThrowLike(other: SocketResponse.RequestHandlingErrorLegacy) =
        this should throwLike(other)

    fun SocketResponse.RequestHandlingErrorLegacy.shouldNotThrowLike(other: SocketResponse.RequestHandlingErrorLegacy) =
        this shouldNot throwLike(other)
}