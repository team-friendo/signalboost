package info.signalboost.signalc.testSupport.dataGenerators

import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genSignalcAddress
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genInt
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genLong
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genSocketHash
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genAbortRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSubscribeRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genTrustRequest
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genBase64EncodedBytes
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genFileName
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genFingerprint
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genPhrase
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genVersionStr
import info.signalboost.signalc.util.KeyUtil.genIdentityKeyPair
import info.signalboost.signalc.util.SocketHashCode
import io.mockk.every
import io.mockk.mockk
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import kotlin.reflect.KClass
import kotlin.reflect.full.primaryConstructor

object SocketResponseGen {

    private fun genUserData() = SocketResponse.UserData(
        username = genPhoneNumber()
    )

    private fun genRequest() = listOf(
       genAbortRequest(),
       genSendRequest(),
       genSubscribeRequest(),
    ).random()

    fun genAbortWarning(
        id: String = genUuidStr(),
        socketHash: SocketHashCode = genSocketHash(),
    ) = SocketResponse.AbortWarning(id, socketHash)

    fun genCleartext(
        username: String = genPhoneNumber(),
        source: SignalcAddress = genSignalcAddress(),
        body: String = genPhrase(),
        attachments: List<SocketResponse.Cleartext.Attachment> = genCleartextAttachments(),
        expiresInSeconds: Int = genInt(),
        timestamp: Long = genLong(),
    ) = SocketResponse.Cleartext(
        data = SocketResponse.Cleartext.Data(
            username = username,
            source = source,
            dataMessage = SocketResponse.Cleartext.DataMessage(
                body = body,
                attachments = attachments,
                expiresInSeconds = expiresInSeconds,
                timestamp = timestamp,
            )
        )
    )

    fun genCleartextAttachment(
        blurHash: String? = null,
        caption: String? = null,
        contentType: String = "image/jpeg",
        digest: String? = null,
        filename: String = genFileName(),
        height: Int = genInt(),
        id: String = genUuidStr(),
        key: String = genBase64EncodedBytes(),
        size: Int? = null,
        width: Int = genInt(),
        voiceNote: Boolean = false,
    ) = SocketResponse.Cleartext.Attachment(
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

    private fun genCleartextAttachments() = List(2) {
        genCleartextAttachment()
    }

    fun genIsAliveResponse(
        id: String = genUuidStr()
    ) = SocketResponse.IsAlive(id)

    fun genRequestHandlingError(
        id: String = genUuidStr(),
        error: Throwable = Error(genPhrase()),
        request: SocketRequest = genRequest(),
    ) = SocketResponse.RequestHandlingError(id,error,request)

    fun genRequestInvalidError(
        error: Throwable = Error(genPhrase()),
        commandStr: String = genPhrase()
    ) = SocketResponse.RequestInvalidError(error,commandStr)


    fun genDecryptionError() = SocketResponse.DecryptionError(
        genSignalcAddress(),
        genSignalcAddress(),
        Error(genPhrase())
    )

    fun genDropped(envType: Int = 1) = SocketResponse.Dropped(
        genSignalcAddress(),
        genSignalcAddress(),
        mockk<SignalServiceEnvelope> {
            every { type } returns envType
        }
    )

    fun genInboundIdentityFailure(
        localAddress: SignalcAddress = genSignalcAddress(),
        remoteAddress: SignalcAddress = genSignalcAddress(),
        fingerprint: String = genFingerprint()
    ) = SocketResponse.InboundIdentityFailure.of(localAddress, remoteAddress, fingerprint)

    fun genRegistrationSuccess(
        id: String = genUuidStr(),
        data : SocketResponse.UserData = genUserData(),
    ) = SocketResponse.RegistrationSuccess(id, data)

    fun genRegistrationError(
        id: String = genUuidStr(),
        data : SocketResponse.UserData = genUserData(),
        error: Throwable = Error(genPhrase()),
    ) = SocketResponse.RegistrationError(id, data, error)


    fun genSendResults(
        resultKClass:  KClass<out SignalcSendResult> = SignalcSendResult.Success::class,
        id: String = genUuidStr(),
        address: SignalcAddress = genSignalcAddress(),
        untrustedIdentityKey: IdentityKey = genIdentityKeyPair().publicKey
    ): SocketResponse.SendResults  {
        val constructWith = resultKClass.primaryConstructor!!::call
        val concreteScSendResult = when(resultKClass) {
            SignalcSendResult.IdentityFailure::class -> (constructWith)(arrayOf(address, untrustedIdentityKey))
            SignalcSendResult.Success::class -> (constructWith)(arrayOf(address, false, true, 0L))
            else -> (constructWith)(arrayOf(address))
        }
        return SocketResponse.SendResults(
            id = id,
            data = listOf(SocketResponse.SendResult.of(concreteScSendResult))
        )
    }

    fun genSetExpirationFailed(
        resultKClass: KClass<out SignalcSendResult> = SignalcSendResult.Success::class,
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        recipientAddress: SignalcAddress = genSignalcAddress(),
    ) = SocketResponse.SetExpirationFailed(
        id = id,
        username = username,
        recipientAddress = recipientAddress,
        resultType = resultKClass.simpleName ?: "Unknown"
    )

    fun genSetExpirationSuccess(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        recipientAddress: SignalcAddress = genSignalcAddress(),
    ) = SocketResponse.SetExpirationSuccess(
        id = id,
        username = username,
        recipientAddress = recipientAddress,
    )


    fun genSubscriptionSuccess(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
    ) = SocketResponse.SubscriptionSuccess(id, username)

    fun genSubscriptionFailed(
        id: String = genUuidStr(),
        error: Throwable = Error(genPhrase()),
    ) = SocketResponse.SubscriptionFailed(id, error)

    fun genSubscriptionDisrupted(
        id: String = genUuidStr(),
        error: Throwable = Error(genPhrase()),
    ) = SocketResponse.SubscriptionDisrupted(id,error)

    fun genTrustSuccess(
        id: String = genUuidStr(),
        data: SocketResponse.TrustSuccess.Data = SocketResponse.TrustSuccess.Data(
            message = genPhrase(),
            request = genTrustRequest(id = id)
        ),
    ) = SocketResponse.TrustSuccess(id, data)

    fun genVerificationSuccess(
        id: String = genUuidStr(),
        data: SocketResponse.UserData = genUserData()
    ) = SocketResponse.VerificationSuccess(id, data)

    fun genVerificationError(
        id: String = genUuidStr(),
        data: SocketResponse.UserData = genUserData(),
        error: Throwable = Error(genPhrase()),
    ) = SocketResponse.VerificationError(id, data, error)

    fun genVersionResponse(
        id: String = genUuidStr(),
        data: SocketResponse.Version.VersionData = SocketResponse.Version.VersionData(genVersionStr())
    ) = SocketResponse.Version(id, data)
}