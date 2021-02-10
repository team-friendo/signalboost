package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.fixtures.Address.genSignalServiceAddress
import io.mockk.every
import io.mockk.mockk
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

object SocketOutMessage {

    fun genPhrase() = listOf(
        "a screaming comes across the sky",
        "call me ishmael"
    ).random()

    fun genCommand() = listOf(
        "abort",
        "close",
        "send",
        "subscribe",
    ).random()

    fun genCleartext() = Cleartext(
        genSignalServiceAddress(),
        genSignalServiceAddress(),
        genPhrase()
    )

    fun genCommandExecutionError() = CommandExecutionError(
        genCommand(),
        Error(genPhrase())
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