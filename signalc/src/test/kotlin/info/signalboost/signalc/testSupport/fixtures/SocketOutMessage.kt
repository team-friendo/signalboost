package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genSignalServiceAddress
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSubscribeRequest
import info.signalboost.signalc.testSupport.fixtures.StringGen.genPhrase
import io.mockk.every
import io.mockk.mockk
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

object SocketOutMessage {

    fun genCommand() = listOf(
       SocketRequest.Abort,
       SocketRequest.Close,
       genSendRequest(),
       genSubscribeRequest(),
    ).random()

    fun genCleartext() = Cleartext(
        genSignalServiceAddress(),
        genSignalServiceAddress(),
        genPhrase()
    )

    fun genCommandExecutionError() = CommandExecutionException(
        Error(genPhrase()),
        genCommand(),
    )

    fun genDecryptionError() = DecryptionError(
        genSignalServiceAddress(),
        genSignalServiceAddress(),
        Error(genPhrase())
    )

    fun genDropped(envType: Int = 1) = Dropped(
        genSignalServiceAddress(),
        genSignalServiceAddress(),
        mockk<SignalServiceEnvelope>{
            every { type } returns envType
        }
    )

    fun genSubscriptionFailed() = SubscriptionFailed(
        Error(genPhrase())
    )

    fun genSubscriptionDisrupted() = SubscriptionDisrupted(
        Error(genPhrase())
    )

    fun genShutdown() = Shutdown(
        Any().hashCode()
    )
}