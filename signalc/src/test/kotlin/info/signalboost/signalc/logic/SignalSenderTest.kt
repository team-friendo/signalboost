package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.SignalSender.Companion.asAddress
import info.signalboost.signalc.model.SocketRequest.Companion.DEFAULT_EXPIRY_TIME
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.FileGen.deleteAllAttachments
import info.signalboost.signalc.testSupport.dataGenerators.FileGen.genJpegFile
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSendAttachment
import info.signalboost.signalc.testSupport.matchers.SignalMessageMatchers.signalDataMessage
import info.signalboost.signalc.testSupport.matchers.SignalMessageMatchers.signalExpirationUpdate
import info.signalboost.signalc.util.KeyUtil.genUuidStr
import info.signalboost.signalc.util.TimeUtil
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SignalServiceAttachmentStream
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalSenderTest : FreeSpec({
    runBlockingTest {

        val testScope = this
        val app = Application(Config.mockStore).run(testScope)
        val verifiedAccount = genVerifiedAccount()
        val messageSender = app.signalSender

        beforeSpec {
            mockkObject(TimeUtil)
            mockkConstructor(SignalServiceMessageSender::class)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            unmockkAll()
            testScope.teardown()
        }

        "#send" - {
            val recipientPhone = genPhoneNumber()
            val dataMessageSlot = slot<SignalServiceDataMessage>()
            every {
                anyConstructed<SignalServiceMessageSender>().sendMessage(
                    any(),
                    any(),
                    capture(dataMessageSlot),
                )
            } returns mockk {
                every { success } returns mockk()
            }

            "sends a data message to intended recipient" {
                val now = TimeUtil.nowInMillis()
                val result = messageSender.send(
                    sender = verifiedAccount,
                    recipient = recipientPhone.asAddress(),
                    body = "hello!",
                    expiration = 5000,
                    attachments = emptyList(),
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
                messageSender.send(
                    verifiedAccount,
                    recipientPhone.asAddress(),
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

                messageSender.send(
                    sender = verifiedAccount,
                    recipient = recipientPhone.asAddress(),
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

        "#setExpiration" - {
            val recipientPhone = genPhoneNumber()
            every {
                anyConstructed<SignalServiceMessageSender>().sendMessage(any(), any(), any())
            } returns mockk {
                every { success } returns mockk()
            }

            "sends an expiration update to intended recipient" {
                val result = messageSender.setExpiration(
                    sender = verifiedAccount,
                    recipient = recipientPhone.asAddress(),
                    expiresInSeconds = 60,
                )
                verify {
                    anyConstructed<SignalServiceMessageSender>().sendMessage(
                        SignalServiceAddress(null, recipientPhone),
                        absent(),
                        signalExpirationUpdate(60)
                    )
                }
                result.success shouldNotBe null
            }
        }
    }
})
