package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genSocketAddress
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSubscribeRequest
import info.signalboost.signalc.testSupport.fixtures.StringGen.genPhrase
import io.mockk.every
import io.mockk.mockk
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

object SocketResponseGen {

    fun genRequest() = listOf(
       SocketRequest.Abort,
       SocketRequest.Close,
       genSendRequest(),
       genSubscribeRequest(),
    ).random()

    fun genCleartext() = SocketResponse.Cleartext(
        genSocketAddress(),
        genSocketAddress(),
        genPhrase()
    )
    fun genRequestHandlingException(
        error: Throwable = Error(genPhrase()),
        request: SocketRequest = genRequest(),
    ) = SocketResponse.RequestHandlingException(error,request)

    fun genRequestInvalidException(
        error: Throwable = Error(genPhrase()),
        commandStr: String = genPhrase()
    ) = SocketResponse.RequestInvalidException(error,commandStr)


    fun genDecryptionException() = SocketResponse.DecryptionException(
        genSocketAddress(),
        genSocketAddress(),
        Error(genPhrase())
    )

    fun genDropped(envType: Int = 1) = SocketResponse.Dropped(
        genSocketAddress(),
        genSocketAddress(),
        mockk<SignalServiceEnvelope> {
            every { type } returns envType
        }
    )

    fun genSendException() = SocketResponse.SendException
    fun genSendSuccess() = SocketResponse.SendSuccess

    fun genSubscriptionFailed() = SocketResponse.SubscriptionFailed(
        Error(genPhrase())
    )

    fun genSubscriptionDisrupted() = SocketResponse.SubscriptionDisrupted(
        Error(genPhrase())
    )

    fun genShutdown() = SocketResponse.Shutdown(
        Any().hashCode()
    )
}