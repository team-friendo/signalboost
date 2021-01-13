package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.Messenger.Companion.DEFAULT_EXPIRY_TIME
import info.signalboost.signalc.logic.Messenger.Companion.asAddress
import info.signalboost.signalc.testSupport.fixtures.Account.genVerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.PhoneNumber.genPhoneNumber
import info.signalboost.signalc.testSupport.matchers.Matchers.signalDataMessage
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldNotBe
import io.mockk.*
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.push.SignalServiceAddress

class MessageSenderTest : FreeSpec({
    val app = Application(Config.test)
    val verifiedAccount = genVerifiedAccount()
    val messageSender = Messenger(app)

    beforeSpec {
        mockkObject(TimeUtil)
        mockkConstructor(SignalServiceMessageSender::class)
    }

    afterTest {
        clearAllMocks(answers = false, childMocks = false, objectMocks = false)
    }

    afterSpec  {
        unmockkAll()
    }

    "#send" - {
        val recipientPhone = genPhoneNumber()
        every {
            anyConstructed<SignalServiceMessageSender>().sendMessage(any(),any(),any())
        } returns mockk {
            every { success } returns mockk()
        }
        every {
            app.store.signalProtocol.of(any())
        } returns mockk()

        "sends a message from a message sender" {
            val now = TimeUtil.nowInMillis()
            val result = messageSender.send(
                sender = verifiedAccount,
                recipient = recipientPhone.asAddress(),
                body = "hello!",
                expiration = 5000,
                timestamp = now,
            )
            verify {
                anyConstructed<SignalServiceMessageSender>().sendMessage(
                    SignalServiceAddress(null, recipientPhone),
                    absent(),
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
            messageSender.send(verifiedAccount, recipientPhone.asAddress(), "hello!")
            verify {
                anyConstructed<SignalServiceMessageSender>().sendMessage(
                    any(),
                    any(),
                    signalDataMessage(timestamp = 1000L)
                )
            }
        }

        "provides a default expiry time if none provided" {
            messageSender.send(verifiedAccount, recipientPhone.asAddress(),"hello!")
            verify {
                anyConstructed<SignalServiceMessageSender>().sendMessage(
                    any(),
                    any(),
                    signalDataMessage(expiresInSeconds = DEFAULT_EXPIRY_TIME)
                )
            }
        }
    }
})
