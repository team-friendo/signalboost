package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genSerializableAddress
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.fixtures.NumGen.genInt
import info.signalboost.signalc.testSupport.fixtures.NumGen.genLong
import info.signalboost.signalc.testSupport.fixtures.NumGen.genSocketHash
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genAbortRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genCloseRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSubscribeRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genTrustRequest
import info.signalboost.signalc.testSupport.fixtures.StringGen.genFingerprint
import info.signalboost.signalc.testSupport.fixtures.StringGen.genPhrase
import info.signalboost.signalc.testSupport.fixtures.StringGen.genVersionStr
import info.signalboost.signalc.util.SocketHashCode
import io.mockk.every
import io.mockk.mockk
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

object SocketResponseGen {

    private fun genUserData() = SocketResponse.UserData(
        username = genPhoneNumber()
    )

    fun genRequest() = listOf(
       genAbortRequest(),
       genCloseRequest(),
       genSendRequest(),
       genSubscribeRequest(),
    ).random()

    fun genAbortWarning(
        id: String = genUuidStr(),
        socketHash: SocketHashCode = genSocketHash(),
    ) = SocketResponse.AbortWarning(id, socketHash)

    fun genCleartext() = SocketResponse.Cleartext(
        data = SocketResponse.Cleartext.Data(
            username = genPhoneNumber(),
            source = genSerializableAddress(),
            dataMessage = SocketResponse.Cleartext.DataMessage(
                body = genPhrase(),
                attachments = emptyList(), // TODO: fix this!
                expiresInSeconds = genInt(),
                timestamp = genLong(),
            )
        )
    )
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
        genSerializableAddress(),
        genSerializableAddress(),
        Error(genPhrase())
    )

    fun genDropped(envType: Int = 1) = SocketResponse.Dropped(
        genSerializableAddress(),
        genSerializableAddress(),
        mockk<SignalServiceEnvelope> {
            every { type } returns envType
        }
    )

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
        id: String = genUuidStr(),
        address: SerializableAddress = genSerializableAddress(),
        type: SendResultType = SendResultType.SUCCESS,
        untrustedFingerprint: String = genFingerprint(),
    ) = SocketResponse.SendResults(
        id = id,
        data = listOf(
            genSendResult(
                address,
                type,
                untrustedFingerprint
            )
        )
    )

    private fun genSendResult(
        address: SerializableAddress = genSerializableAddress(),
        type: SendResultType = SendResultType.SUCCESS,
        untrustedFingerprint: String? = null,
    ) = when(type) {
        SendResultType.SUCCESS -> SocketResponse.SendResult(address, SocketResponse.SendResult.Success())
        SendResultType.IDENTITY_FAILURE -> SocketResponse.SendResult(address, identityFailure = untrustedFingerprint)
        SendResultType.NETWORK_FAILURE -> SocketResponse.SendResult(address, networkFailure = true)
        SendResultType.UNREGISTERED_FAILURE -> SocketResponse.SendResult(address, unregisteredFailure = true)
        SendResultType.UNKNOWN_ERROR -> SocketResponse.SendResult(address, unknownError = true)
    }

    fun genSubscriptionSuccess(
        id: String = genUuidStr(),
    ) = SocketResponse.SubscriptionSuccess(id)

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
        data: SocketResponse.TrustSuccess.TrustData = SocketResponse.TrustSuccess.TrustData(
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