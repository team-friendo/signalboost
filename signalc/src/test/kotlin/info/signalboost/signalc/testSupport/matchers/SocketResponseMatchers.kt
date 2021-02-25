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

    fun MockKMatcherScope.requestHandlingError(
        request: SocketRequest,
        error: Throwable,
    ): SocketResponse.RequestHandlingError = match {
        it.request == request && it.error throwsLike error
    }

    fun MockKMatcherScope.registrationError(
        id: String,
        data: SocketResponse.UserData,
        error: Throwable,
    ): SocketResponse.RegistrationError = match {
        it.id == id &&
                it.data == data &&
                it.error throwsLike error
    }

    fun MockKMatcherScope.subscriptionFailed(
        id: String,
        error: Throwable,
    ): SocketResponse.SubscriptionFailed = match {
        it.id == id && it.error throwsLike error
    }

    fun MockKMatcherScope.sendSuccess(
        request: SocketRequest.Send,
    ): SocketResponse.SendResults = match {
        it.id == request.id && it.data == listOf(SocketResponse.SendResult.success(request))
    }

    fun MockKMatcherScope.verificationError(
        id: String,
        data: SocketResponse.UserData,
        error: Throwable,
    ): SocketResponse.VerificationError = match {
        it.id == id &&
                it.data == data &&
                it.error throwsLike error
    }

    private infix fun Throwable.throwsLike(other: Throwable): Boolean =
        message == other.message && (cause == other.cause || javaClass == other.javaClass)
}