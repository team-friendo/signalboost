package info.signalboost.signalc.testSupport.matchers

import info.signalboost.signalc.model.*
import info.signalboost.signalc.util.SocketHashCode
import io.mockk.MockKMatcherScope
import org.whispersystems.libsignal.fingerprint.DisplayableFingerprint
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

object SocketResponseMatchers {

    fun MockKMatcherScope.abortWarning(
        id: String,
        socketHash: SocketHashCode,
    ): SocketResponse.AbortWarning = match {
        it.id == id && it.socketHash == socketHash
    }

    fun MockKMatcherScope.cleartext(
        sender: SignalcAddress,
        recipient: SignalcAddress,
        body: String,
        attachments: List<SocketResponse.Cleartext.Attachment> = emptyList(),
    ): SocketResponse.Cleartext = match {
        it.data.source == sender &&
                it.data.username == recipient.number &&
                it.data.dataMessage.body == body &&
                it.data.dataMessage.attachments == attachments
    }

    fun MockKMatcherScope.decryptionError(
        sender: SignalcAddress,
        recipient: SignalcAddress,
        cause: Throwable
    ): SocketResponse.DecryptionError = match {
        it.sender == sender &&
                it.recipient == recipient &&
                it.error == cause
    }

    fun MockKMatcherScope.dropped(
        sender: SignalcAddress,
        recipient: SignalcAddress,
        envelope: SignalServiceEnvelope,
    ): SocketResponse.Dropped = match {
        it.sender == sender &&
                it.recipient == recipient &&
                it.envelope == envelope
    }

    fun MockKMatcherScope.inboundIdentityFailure(
        sender: SignalcAddress,
        recipient: SignalcAddress,
        fingerprint: String?
    ): SocketResponse.InboundIdentityFailure = match {
        it.data.local_address.number == recipient.number &&
                it.data.remote_address.number == sender.number &&
                it.data.fingerprint == fingerprint
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

    fun MockKMatcherScope.subscriptionDisrupted(
        id: String,
        error: Throwable,
    ): SocketResponse.SubscriptionDisrupted = match {
        it.id == id && it.error throwsLike error
    }

    fun MockKMatcherScope.subscriptionFailed(
        id: String,
        error: Throwable,
    ): SocketResponse.SubscriptionFailed = match {
        it.id == id && it.error throwsLike error
    }

    fun MockKMatcherScope.subscriptionSuccess(
        id: String,
        username: String,
    ): SocketResponse.SubscriptionSuccess = match {
        it.id == id && it.username == username
    }


    fun MockKMatcherScope.sendSuccess(
        request: SocketRequest.Send,
    ): SocketResponse.SendResults = match {
        it.id == request.id && it.data == listOf(SocketResponse.SendResult.success(request))
    }

    fun MockKMatcherScope.trustSuccess(
        request: SocketRequest.Trust,
    ): SocketResponse.TrustSuccess = match {
        it.id == request.id && it.data.request == request
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