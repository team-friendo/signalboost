package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.testSupport.fixtures.Account.genVerifiedAccount
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runBlockingTest
import org.whispersystems.signalservice.api.SignalServiceMessagePipe
import org.whispersystems.signalservice.api.SignalServiceMessageReceiver
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

@ExperimentalCoroutinesApi
class SignalMessageReceiverTest : FreeSpec({
    runBlockingTest {
        val app = Application(Config.test, this)
        val messageReceiver = SignalMessageReceiver(app)

        beforeSpec {
            mockkConstructor(SignalServiceMessageReceiver::class)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            unmockkAll()
        }

        "#receiveMessages" - {
            val mockEnvelope = mockk<SignalServiceEnvelope>()
            val mockMessagePipe = mockk<SignalServiceMessagePipe> {
                every { read(any(), any()) } returns mockEnvelope
                every { shutdown() } returns Unit
            }

            every {
                anyConstructed<SignalServiceMessageReceiver>().createMessagePipe()
            }  returns  mockMessagePipe

            "subscribes to messages for an account" {
                launch {
                    val incomingMessages = messageReceiver.receiveMessages(genVerifiedAccount())
                    incomingMessages.receive() shouldBe mockEnvelope
                }
            }
        }
    }
})
