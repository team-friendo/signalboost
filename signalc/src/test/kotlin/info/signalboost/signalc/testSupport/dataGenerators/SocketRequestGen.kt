package info.signalboost.signalc.testSupport.dataGenerators

import info.signalboost.signalc.model.SignalcAddress
import info.signalboost.signalc.model.SocketRequest
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genSignalcAddress
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genInt
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genCaptchaToken
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genFingerprint
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genPhrase
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genVerificationCode

object SocketRequestGen {

    fun genAbortRequest() = SocketRequest.Abort(genUuidStr())

    fun genCloseRequest() = SocketRequest.Close(genUuidStr())

    fun genRegisterRequest(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        captcha: String? = genCaptchaToken(),
    ) = SocketRequest.Register(
        id = id,
        username = username,
        captcha = captcha,
    )

    fun genSendRequest(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        recipientAddress: SignalcAddress = genSignalcAddress(),
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
        recipientAddress: SignalcAddress = genSignalcAddress(),
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
        recipientAddress: SignalcAddress = genSignalcAddress(),
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