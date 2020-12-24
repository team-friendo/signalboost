package info.signalboost.signalc.logic

import info.signalboost.signalc.fixtures.PhoneNumber.genPhoneNumber
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldNotBe
import io.mockk.*
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress

class MessagingTest : FreeSpec({
    afterSpec {
        unmockkAll()
    }

    val recipientPhone = genPhoneNumber()

    fun MockKMatcherScope.dataMessageWith(
        body: String? = null,
        timestamp: Long? = null,
        expiresInSeconds: Int? = null,
    ) = match<SignalServiceDataMessage> {
        // check for equality of each provided param. if param not provided, don't check it!
        body?.let{ _ -> it.body.or("") == body } ?: true &&
            timestamp?.let { _ -> it.timestamp == timestamp } ?: true &&
            expiresInSeconds?.let { _ -> it.expiresInSeconds == expiresInSeconds } ?: true
    }


    "#sendMessage" - {
        val mockMessageSender = mockk<SignalServiceMessageSender>() {
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
                    dataMessageWith(
                        body = "hello!",
                        timestamp = now,
                        expiresInSeconds = 5000,
                    )
                )
            }
            result.success shouldNotBe null
        }

        "provides a default timestamp if none provided" {
            mockkObject(TimeUtil)
            every { TimeUtil.nowInMillis() } returns 1000L

            Messaging.sendMessage(mockMessageSender, "hello!", recipientPhone)
            verify {
                mockMessageSender.sendMessage(
                    any(),
                    any(),
                    dataMessageWith(timestamp = 1000L)
                )
            }
        }

        "provides a default expiry time if none provided" {
            Messaging.sendMessage(mockMessageSender, "hello!", recipientPhone)
            verify {
                mockMessageSender.sendMessage(
                    any(),
                    any(),
                    dataMessageWith(expiresInSeconds = Messaging.DEFAULT_EXPIRY_TIME)
                )
            }
        }
    }
})
