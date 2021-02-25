package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.model.SerializableAddress
import info.signalboost.signalc.model.SocketRequest
import info.signalboost.signalc.model.SocketResponse
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genSerializableAddress
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.fixtures.NumGen.genInt
import info.signalboost.signalc.testSupport.fixtures.StringGen.genCaptchaToken
import info.signalboost.signalc.testSupport.fixtures.StringGen.genFingerprint
import info.signalboost.signalc.testSupport.fixtures.StringGen.genPhrase
import info.signalboost.signalc.testSupport.fixtures.StringGen.genVerificationCode

object SocketRequestGen {

    fun genAbortRequest() = SocketRequest.Abort(genUuidStr())

    fun genCloseRequest() = SocketRequest.Close(genUuidStr())

    fun genRegisterRequest(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        captchaToken: String? = genCaptchaToken(),
    ) = SocketRequest.Register(
        id = id,
        username = username,
        captchaToken = captchaToken,
    )

    fun genSendRequest(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        recipientAddress: SerializableAddress = genSerializableAddress(),
        messageBody: String = genPhrase(),
        hasAttachments: Boolean = false,
        attachments: List<SocketRequest.Send.Attachment> =
            if (hasAttachments) genAttachments() else emptyList()
    ) =  SocketRequest.Send(
        id = id,
        username = username,
        recipientAddress = recipientAddress,
        messageBody= messageBody,
        attachments = attachments
    )

    fun genSetExpiration(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        recipientAddress: SerializableAddress = genSerializableAddress(),
        expiresInSeconds: Int = genInt(),
    ) = SocketRequest.SetExpiration(
        id = id,
        username = username,
        recipientAddress = recipientAddress,
        expiresInSeconds = expiresInSeconds
    )

    fun genSubscribeRequest(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
    ) = SocketRequest.Subscribe(
        id = id,
        username = username,
    )

    fun genTrustRequest(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        recipientAddress: SerializableAddress = genSerializableAddress(),
        fingerprint: String = genFingerprint(),
    ) = SocketRequest.Trust(
        id,
        username,
        recipientAddress,
        fingerprint,
    )

    fun genUnsubscribe(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
    ) = SocketRequest.Unsubscribe(
        id = id,
        username = username,
    )

    fun genVerifyRequest(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        code: String = genVerificationCode(),
    ) = SocketRequest.Verify(
        id = id,
        username = username,
        code = code,
    )

    private fun genAttachments(): List<SocketRequest.Send.Attachment> = listOf(
        SocketRequest.Send.Attachment(
            filename = "/foo/bar.jpg",
            caption = "baz is really bamming!",
            width = 42,
            height = 42,
        ),
        SocketRequest.Send.Attachment(
            filename = "/bar/foo.jpg",
            caption = "bam is really bazzing!",
            width = 24,
            height = 24,
        )
    )
}