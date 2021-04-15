package info.signalboost.signalc.testSupport.dataGenerators

import info.signalboost.signalc.model.SignalcAddress
import info.signalboost.signalc.model.SocketRequest
import info.signalboost.signalc.model.SocketRequest.Companion.DEFAULT_EXPIRY_TIME
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genSignalcAddress
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genInt
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genCaptchaToken
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genFileName
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
            if (hasAttachments) genSendAttachments() else emptyList(),
        expiresInSeconds: Int = DEFAULT_EXPIRY_TIME,
    ) =  SocketRequest.Send(
        id = id,
        username = username,
        recipientAddress = recipientAddress,
        messageBody= messageBody,
        attachments = attachments,
        expiresInSeconds = expiresInSeconds,
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

    fun genUnsubscribeRequest(
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

    fun genSendAttachment(
        blurHash: String? = null,
        caption: String? = null,
        contentType: String = "image/jpeg",
        digest: String? = null,
        filename: String = genFileName(),
        height: Int = genInt(),
        id: String = genUuidStr(),
        key: String? = null,
        size: Int? = null,
        width: Int = genInt(),
        voiceNote: Boolean = false,
    ): SocketRequest.Send.Attachment = SocketRequest.Send.Attachment(
        blurHash,
        caption,
        contentType,
        digest,
        filename,
        height,
        id,
        key,
        size,
        width,
        voiceNote,
    )

    private fun genSendAttachments(): List<SocketRequest.Send.Attachment> = List(2) {
        genSendAttachment()
    }
}