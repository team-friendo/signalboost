package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.SignalcSendResult
import info.signalboost.signalc.model.SocketRequest.Companion.DEFAULT_EXPIRY_TIME
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.asSignalServiceAddress
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.asSignalcAddress
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.FileGen.deleteAllAttachments
import info.signalboost.signalc.testSupport.dataGenerators.FileGen.genJpegFile
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSendAttachment
import info.signalboost.signalc.testSupport.matchers.SignalMessageMatchers.signalDataMessage
import info.signalboost.signalc.testSupport.matchers.SignalMessageMatchers.signalExpirationUpdate
import info.signalboost.signalc.testSupport.matchers.SignalMessageMatchers.signalReceiptMessage
import info.signalboost.signalc.util.KeyUtil.genUuidStr
import info.signalboost.signalc.util.TimeUtil
import info.signalboost.signalc.util.TimeUtil.nowInMillis
import io.kotest.assertions.timing.eventually
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.should
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.beInstanceOf
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runBlockingTest
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.crypto.UnidentifiedAccessPair
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceAttachmentStream
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.messages.SignalServiceReceiptMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.io.File
import java.io.InputStream
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.Duration
import kotlin.time.ExperimentalTime


@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalSenderTest : FreeSpec({
    runBlockingTest {

        val testScope = this
        val drainPollInterval = Duration.milliseconds(10)
        val drainTimeout = Duration.milliseconds(50)
        val config = Config.mockAllExcept(SignalSender::class).copy(
            timers = Config.default.timers.copy(
                drainPollInterval = drainPollInterval,
                drainTimeout = drainTimeout,
            )
        )

        val app = Application(config).run(testScope)
        val verifiedAccount = genVerifiedAccount()
        val contactPhoneNumber = genPhoneNumber()
        val timeout = Duration.milliseconds(5)

        val mockSuccess = mockk<SendMessageResult.Success> {
            every { isNeedsSync } returns true
            every { isUnidentified } returns false
            every { duration } returns 0L
        }

        fun sendingSucceeds() {
            every {
                anyConstructed<SignalServiceMessageSender>().sendMessage(any(), any(), any())
            } returns mockk {
                every { address } returns contactPhoneNumber.asSignalServiceAddress()
                every { success } returns mockSuccess
            }
        }

        beforeSpec {
            mockkObject(TimeUtil)
            mockkConstructor(SignalServiceMessageSender::class)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            unmockkAll()
            app.signalSender.messagesInFlight.set(0)
            testScope.teardown()
        }

        "#drain" - {
            /********************************
             * NOTE(aguestuser|2021-04-22):
             * For reasons that are beyond me, this bracket will only pass deterministically
             * when *not* run not in isolation if it runs before all other tests in the suite.
             * (Perhaps something to do with thread contention?)
             ********************************/
            beforeTest {
                app.signalSender.messagesInFlight.set(3)
            }
            afterTest {
                app.signalSender.messagesInFlight.set(0)
            }

            "when all messages can be drained before timeout" - {
                "returns true and the number of messages drained" {
                    launch {
                        delay(drainPollInterval)
                        repeat(3) {
                            app.signalSender.messagesInFlight.getAndDecrement()
                        }
                    }
                    app.signalSender.drain() shouldBe Triple(true, 3, 0)
                }
            }

            "when all messages cannot be drained before timeout" - {
                "returns false and number messages remaining" {
                    launch {
                        delay(drainPollInterval)
                        app.signalSender.messagesInFlight.getAndDecrement()
                    }
                    app.signalSender.drain() shouldBe Triple(false, 3, 2)
                }
            }
        }

        "#send" - {
            val dataMessageSlot = slot<SignalServiceDataMessage>()
            every {
                anyConstructed<SignalServiceMessageSender>().sendMessage(
                    any(),
                    any(),
                    capture(dataMessageSlot),
                )
            } returns mockk {
                every { address } returns contactPhoneNumber.asSignalServiceAddress()
                every { success } returns mockSuccess
            }

            val now = TimeUtil.nowInMillis()
            suspend fun sendHello(): SignalcSendResult = app.signalSender.send(
                sender = verifiedAccount,
                recipient = contactPhoneNumber.asSignalcAddress(),
                body = "hello!",
                expiration = 5000,
                attachments = emptyList(),
                timestamp = now,
            )

            "sends a data message to intended recipient" {
                val result = sendHello()
                    verify {
                        anyConstructed<SignalServiceMessageSender>().sendMessage(
                            SignalServiceAddress(null, contactPhoneNumber),
                            any(),
                            signalDataMessage(
                                body = "hello!",
                                timestamp = now,
                                expiresInSeconds = 5000,
                            )
                        )
                    }
                result should beInstanceOf<SignalcSendResult.Success>()
            }

            "provides a default timestamp if none provided" {
                every { TimeUtil.nowInMillis() } returns 1000L
                app.signalSender.send(
                    verifiedAccount,
                    contactPhoneNumber.asSignalcAddress(),
                    "hello!",
                    DEFAULT_EXPIRY_TIME,
                    emptyList()
                )
                verify {
                    anyConstructed<SignalServiceMessageSender>().sendMessage(
                        any(),
                        any(),
                        signalDataMessage(timestamp = 1000L)
                    )
                }
            }

            "increments and decrements a messages-in-flight-counter (for queue size tracking)" {
                mockkObject(app.signalSender.messagesInFlight).also {
                    every { app.signalSender.messagesInFlight.getAndIncrement() } returns 1
                    every { app.signalSender.messagesInFlight.getAndDecrement() } returns 0
                    every { app.signalSender.messagesInFlight.set(any()) } returns Unit
                }
                app.signalSender.send(
                    verifiedAccount,
                    contactPhoneNumber.asSignalcAddress(),
                    "",
                    DEFAULT_EXPIRY_TIME,
                    emptyList()
                )

                eventually(timeout) {
                    verify {
                        app.signalSender.messagesInFlight.getAndIncrement()
                        app.signalSender.messagesInFlight.getAndDecrement()
                    }
                }
            }

            "handling sealed-/unsealed-sender messages" - {
                "when sealed sender tokens can be derived from a recipient's profile key" - {
                    val mockkUnidentifiedAccessPair = mockk<UnidentifiedAccessPair>()
                    coEvery {
                        app.accountManager.getUnidentifiedAccessPair(verifiedAccount.id, contactPhoneNumber)
                    } returns mockkUnidentifiedAccessPair

                    "sends a sealed sender message with access tokens derived from key" {
                        sendHello()
                        verify {
                            anyConstructed<SignalServiceMessageSender>().sendMessage(
                                any(),
                                Optional.of(mockkUnidentifiedAccessPair),
                                any()
                            )
                        }
                    }
                }

                "when sealed sender tokens cannot be derrived for a recipient (b/c missing profile key)" - {
                    "when unsealed messages are allowed" - {
                        coEvery {
                            app.accountManager.getUnidentifiedAccessPair(verifiedAccount.id, contactPhoneNumber)
                        } returns null

                        "sends an unsealed-sender message (with no access tokens)" {
                            sendHello()
                            verify {
                                anyConstructed<SignalServiceMessageSender>().sendMessage(
                                    any(),
                                    Optional.absent(),
                                    any()
                                )
                            }
                        }
                    }

                    "when unsealed messages are not allowed" - {
                        val config2 = config.copy(
                            toggles = config.toggles.copy(
                                blockUnsealedMessages = true,
                            )
                        )
                        val app2 = Application(config2).run(testScope)
                        coEvery {
                            app2.accountManager.getUnidentifiedAccessPair(verifiedAccount.identifier, contactPhoneNumber)
                        } returns null

                        val recipientAddress = contactPhoneNumber.asSignalcAddress()

                        afterTest {
                            app2.stop()
                        }

                        "does not send any message" {
                            app2.signalSender.send(
                                sender = verifiedAccount,
                                recipient = recipientAddress,
                                body = "hello!",
                                expiration = 5000,
                                attachments = emptyList(),
                                timestamp = now,
                            ) shouldBe SignalcSendResult.Blocked(recipientAddress)
                            verify(exactly = 0) {
                                anyConstructed<SignalServiceMessageSender>().sendMessage(any(), any(), any())
                            }
                        }
                    }
                }
            }

            "when an attachment is present" - {
                val attachmentId = genUuidStr()
                val file = genJpegFile(File(app.signal.attachmentsPath, attachmentId))
                val sendAttachment = genSendAttachment(
                    id = attachmentId,
                    filename = file.name,
                )

                val mockAttachmentStream = mockk<SignalServiceAttachmentStream>()
                val inputStreamSlot = slot<InputStream>()

                mockkObject(SignalSender.AttachmentStream)
                every {
                    SignalSender.AttachmentStream.of(
                        any(),
                        any(),
                        capture(inputStreamSlot),
                    )
                } returns mockAttachmentStream

                afterTest {
                    deleteAllAttachments(app)
                }

                app.signalSender.send(
                    sender = verifiedAccount,
                    recipient = contactPhoneNumber.asSignalcAddress(),
                    body = "hello!",
                    expiration = 5000,
                    attachments = listOf(sendAttachment),
                )

                "reads attachment from filesystem and sends it to recipient" {
                    verify {
                        SignalSender.AttachmentStream.of(
                            sendAttachment,
                            file,
                            any(),
                        )
                    }
                    /************************************************
                     * The below assertion demonstrates 2 important (non-obvious) things:
                     * (1) the input stream was produced by our jpeg file (b/c it is ready to
                     *     produce a byte stream the same size as our jpeg attachment
                     * (2) the stream is NOT CLOSED (very important b/c libsignal will
                     *     throw when it tries to use the stream to upload the attachemnt
                     *     and the input stream has been closed
                     ***********************************************/
                    inputStreamSlot.captured.available() shouldBe file.length()

                    verify {
                        anyConstructed<SignalServiceMessageSender>().sendMessage(
                            any(),
                            any(),
                            signalDataMessage(
                                attachments = Optional.of(listOf(mockAttachmentStream))
                            )
                        )
                    }
                }
            }
        }

        "#sendProfileKey" - {
            sendingSucceeds()

            "sends a profile key to a contact" {
                app.signalSender.sendProfileKey(verifiedAccount, contactPhoneNumber.asSignalcAddress())
                verify {
                    anyConstructed<SignalServiceMessageSender>().sendMessage(
                        contactPhoneNumber.asSignalServiceAddress(),
                        any(),
                        signalDataMessage(
                            isProfileKeyUpdate = true,
                            profileKey = verifiedAccount.profileKeyBytes,
                        )
                    )
                }
            }
        }

        "#sendReceipt" - {
            val timestamp = nowInMillis()
            every {
                anyConstructed<SignalServiceMessageSender>().sendReceipt(any(), any(), any())
            } returns Unit

            "sends a READ receipt to a contact" {
                app.signalSender.sendReceipt(verifiedAccount, contactPhoneNumber.asSignalcAddress(), timestamp)
                verify {
                    anyConstructed<SignalServiceMessageSender>().sendReceipt(
                        contactPhoneNumber.asSignalServiceAddress(),
                        Optional.absent(),
                        signalReceiptMessage(
                            type = SignalServiceReceiptMessage.Type.READ,
                            timestamps = listOf(timestamp),
                            id = timestamp,
                        )
                    )
                }
            }
        }

        "#setExpiration" - {
            val recipientPhone = genPhoneNumber()
            every {
                anyConstructed<SignalServiceMessageSender>().sendMessage(any(), any(), any())
            } returns mockk {
                every { address } returns recipientPhone.asSignalServiceAddress()
                every { success } returns mockSuccess
            }

            "sends an expiration update to intended recipient" {
                val result = app.signalSender.setExpiration(
                    sender = verifiedAccount,
                    recipient = recipientPhone.asSignalcAddress(),
                    expiresInSeconds = 60,
                )
                verify {
                    anyConstructed<SignalServiceMessageSender>().sendMessage(
                        SignalServiceAddress(null, recipientPhone),
                        Optional.absent(),
                        signalExpirationUpdate(60)
                    )
                }
                result should beInstanceOf<SignalcSendResult.Success>()
            }
        }
    }
})
