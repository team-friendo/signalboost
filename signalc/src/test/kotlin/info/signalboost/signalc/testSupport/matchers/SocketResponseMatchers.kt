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

    fun MockKMatcherScope.abortWarning(
        id: String,
        socketHash: SocketHashCode,
    ): SocketResponse.AbortWarning = match {
        it.id == id && it.socketHash == socketHash
    }

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
    ): SocketResponse.RequestHandlingError = match {
        it.request == command &&
                it.error.javaClass == error.javaClass &&
                it.error.message == error.message
    }

    fun MockKMatcherScope.subscriptionFailed(
        id: String,
        error: Throwable,
    ): SocketResponse.SubscriptionFailed = match {
        it.id == id &&
        it.error.javaClass == error.javaClass && it.error.message == error.message
    }

    fun MockKMatcherScope.sendSuccess(
        request: SocketRequest.Send,
    ): SocketResponse.SendResults = match {
        it.id == request.id && it.data == listOf(SocketResponse.SendResult.success(request))
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




    fun MockKMatcherScope.shouldBeLike(
        other: SocketResponse.RequestHandlingError,
    ): SocketResponse.RequestHandlingError = match {
        it.error.message == other.error.message &&
        it.request == other.request
    }

    fun throwLike(other: SocketResponse.RequestHandlingError) = object:
        Matcher<SocketResponse.RequestHandlingError> {
        override fun test(value: SocketResponse.RequestHandlingError) = MatcherResult(
            value.error.message == other.error.message && value.request == other.request,
            "Request $value should have same error message and request as $other",
            "Request $value should not have same error message and request as $other",
        )
    }

    fun SocketResponse.RequestHandlingError.shouldThrowLike(other: SocketResponse.RequestHandlingError) =
        this should throwLike(other)

    fun SocketResponse.RequestHandlingError.shouldNotThrowLike(other: SocketResponse.RequestHandlingError) =
        this shouldNot throwLike(other)
}