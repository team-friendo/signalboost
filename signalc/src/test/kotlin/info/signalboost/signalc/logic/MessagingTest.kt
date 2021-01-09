package info.signalboost.signalc.logic

import info.signalboost.signalc.testSupport.fixtures.PhoneNumber.genPhoneNumber
import info.signalboost.signalc.testSupport.matchers.Matchers.signalDataMessage
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldNotBe
import io.mockk.*
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.push.SignalServiceAddress

class MessagingTest : FreeSpec({
    val recipientPhone = genPhoneNumber()

    beforeSpec {
        mockkObject(TimeUtil)
    }

    afterTest {
        clearAllMocks(answers = false, childMocks = false, objectMocks = false)
    }

    afterSpec  {
        unmockkAll()
    }

    "#sendMessage" - {
        val mockMessageSender = mockk<SignalServiceMessageSender> {
            every { sendMessage(any(), any(), any()) }  returns mockk() {
                every { success } returns mockk()
            }
        }

        "sends a message from a message sender" {
            val now = TimeUtil.nowInMillis()
            val result = Messaging.sendMessage(
                messageSender = mockMessageSender,
                messageBody = "hello!",
                recipientPhone = recipientPhone,
                expiration = 5000,
                timestamp = now,
            )
            verify {
                mockMessageSender.sendMessage(
                    SignalServiceAddress(null, recipientPhone),
                    Optional.absent(),
                    signalDataMessage(
                        body = "hello!",
                        timestamp = now,
                        expiresInSeconds = 5000,
                    )
                )
            }
            result.success shouldNotBe null
        }

        "provides a default timestamp if none provided" {
            every { TimeUtil.nowInMillis() } returns 1000L
            Messaging.sendMessage(mockMessageSender, "hello!", recipientPhone)
            verify {
                mockMessageSender.sendMessage(
                    any(),
                    any(),
                    signalDataMessage(timestamp = 1000L)
                )
            }
        }

        "provides a default expiry time if none provided" {
            Messaging.sendMessage(mockMessageSender, "hello!", recipientPhone)
            verify {
                mockMessageSender.sendMessage(
                    any(),
                    any(),
                    signalDataMessage(expiresInSeconds = Messaging.DEFAULT_EXPIRY_TIME)
                )
            }
        }
    }
})
