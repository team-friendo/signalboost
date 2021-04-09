package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genSignalServiceAddress
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.dataGenerators.FileGen.deleteAllAttachments
import info.signalboost.signalc.testSupport.dataGenerators.FileGen.genJpegInputStream
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genInt
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genCleartextAttachment
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.cleartext
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.decryptionError
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.dropped
import info.signalboost.signalc.util.TimeUtil.nowInMillis
import io.kotest.assertions.timing.eventually
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runBlockingTest
import org.postgresql.util.Base64
import org.signal.libsignal.metadata.ProtocolDuplicateMessageException
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceMessagePipe
import org.whispersystems.signalservice.api.SignalServiceMessageReceiver
import org.whispersystems.signalservice.api.crypto.SignalServiceCipher
import org.whispersystems.signalservice.api.messages.SignalServiceAttachmentRemoteId
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.*
import kotlin.io.path.*
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalReceiverTest : FreeSpec({
    runBlockingTest {
        val testScope = this
        val config = Config.mockAllExcept(SignalReceiver::class)
        val app = Application(config).run(testScope)
        val messageReceiver = app.signalReceiver

        beforeSpec {
            mockkConstructor(SignalServiceMessageReceiver::class)
            mockkConstructor(SignalServiceCipher::class)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            deleteAllAttachments(app)
            unmockkAll()
            testScope.teardown()
        }

        "#receiveMessages" - {
            val recipientAccount = genVerifiedAccount()
            val senderAddress = genSignalServiceAddress()
            val now = nowInMillis()
            val expiryTime = genInt()
            // We cancel the `listen` job after a very short duration so we don't iterate
            // endlessly through the infinite `while` loop that calls `messagePipe#read`
            val timeout = 40.milliseconds
            val pollInterval = 1.milliseconds

            fun signalSendsEnvelopeOf(envelopeType: Int): SignalServiceEnvelope {
                val mockEnvelope = mockk<SignalServiceEnvelope>() {
                    every { type } returns envelopeType
                    every { sourceAddress } returns senderAddress
                    every { timestamp } returns now
                }

                val mockMessagePipe = mockk<SignalServiceMessagePipe> {
                    every { read(any(), any()) } returns mockEnvelope
                    every { shutdown() } returns Unit
                }

                every {
                    anyConstructed<SignalServiceMessageReceiver>().createMessagePipe()
                }  returns  mockMessagePipe

                return mockEnvelope
            }

            "when signal sends an envelope of type UNKNOWN" - {
                val envelope = signalSendsEnvelopeOf(UNKNOWN_VALUE)

                lateinit var sub: Job
                beforeTest { sub = messageReceiver.subscribe(recipientAccount) }
                afterTest { sub.cancel() }

                "relays a DroppedMessage to the socket sender" {
                    eventually(timeout, pollInterval) {
                        coVerify {
                            app.socketSender.send(
                                dropped(
                                    senderAddress.asSignalcAddress(),
                                    recipientAccount.asSignalcAddress(),
                                    envelope
                                )
                            )
                        }
                    }
                }
            }

            "when signal sends an envelope of type CIPHERTEXT" - {
                signalSendsEnvelopeOf(CIPHERTEXT_VALUE)

                "with no attachments" - {
                    "and decryption succeeds" - {
                        val cleartextBody = "a screaming comes across the sky..."

                        every {
                            anyConstructed<SignalServiceCipher>().decrypt(any())
                        } returns mockk {
                            every { dataMessage.orNull() } returns mockk<SignalServiceDataMessage> {
                                every { expiresInSeconds } returns expiryTime
                                every { timestamp } returns now
                                every { body.orNull() } returns cleartextBody
                                every { attachments.orNull() } returns null
                            }
                        }

                        lateinit var sub: Job
                        beforeTest { sub = messageReceiver.subscribe(recipientAccount) }
                        afterTest { sub.cancel() }

                        "relays Cleartext to socket sender" {
                            eventually(timeout, pollInterval) {
                                coVerify {
                                    app.socketSender.send(
                                        cleartext(
                                            senderAddress.asSignalcAddress(),
                                            recipientAccount.asSignalcAddress(),
                                            cleartextBody
                                        )
                                    )
                                }
                            }
                        }
                    }

                    "and message is empty" - {
                        every {
                            anyConstructed<SignalServiceCipher>().decrypt(any())
                        } returns mockk {
                            every { dataMessage.orNull() } returns mockk<SignalServiceDataMessage> {
                                every { expiresInSeconds } returns expiryTime
                                every { timestamp } returns now
                                every { body.orNull() } returns null
                                every { attachments.orNull() } returns null
                            }
                        }

                        lateinit var sub: Job
                        beforeTest { sub = messageReceiver.subscribe(recipientAccount) }
                        afterTest { sub.cancel() }

                        "relays empty message to socket sender" {
                            eventually(timeout, pollInterval) {
                                coVerify {
                                    app.socketSender.send(
                                        cleartext(
                                            senderAddress.asSignalcAddress(),
                                            recipientAccount.asSignalcAddress(),
                                            ""
                                        )
                                    )
                                }
                            }
                        }
                    }

                    "and decryption fails" - {
                        val error = ProtocolDuplicateMessageException(
                            Exception("FAKE ERROR! oh no!"),
                            senderAddress.identifier,
                            42
                        )
                        every {
                            anyConstructed<SignalServiceCipher>().decrypt(any())
                        } throws error

                        lateinit var sub: Job
                        beforeTest { sub = messageReceiver.subscribe(recipientAccount) }
                        afterTest { sub.cancel() }

                        "relays DecryptionError to socket sender" {
                            eventually(timeout, pollInterval) {
                                coVerify {
                                    app.socketSender.send(
                                        decryptionError(
                                            senderAddress.asSignalcAddress(),
                                            recipientAccount.asSignalcAddress(),
                                            error
                                        )
                                    )
                                }
                            }
                        }
                    }
                }

                "with an attachment" - {
                    /**********************************************************
                     *TODO(aguestuser|2021-04-07):
                     *  ugh! this is the most anemic mock-heavy test EVER!
                     *  we could REALLY use an integration test for this instead!
                     *  (against the fake signal server we use for load tests...)
                     *******************************************************/
                    val cleartextBody = "a screaming comes across the sky..."
                    val attachmentId = genUuidStr()
                    val cleartextAttachment = genCleartextAttachment(
                        id = attachmentId,
                        filename = "$attachmentId",
                        // the size of `resources/.../tiny-pink-square.jpg` is 628 bytes
                        size = 628,
                    )

                    every {
                        anyConstructed<SignalServiceMessageReceiver>().retrieveAttachment(any(), any(), any())
                    } answers {
                        genJpegInputStream()
                    }

                    every {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    } returns mockk {
                        every { dataMessage.orNull() } returns mockk<SignalServiceDataMessage> {
                            every { expiresInSeconds } returns expiryTime
                            every { timestamp } returns now
                            every { body.orNull() } returns cleartextBody
                            every { attachments.orNull() } returns listOf(
                                mockk {
                                    every { asPointer() } returns mockk {
                                        every { blurHash } returns Optional.fromNullable(cleartextAttachment.blurHash)
                                        every { caption } returns Optional.fromNullable(cleartextAttachment.caption)
                                        every { contentType } returns cleartextAttachment.contentType
                                        every { digest } returns run {
                                            cleartextAttachment.digest
                                                ?.let { Optional.of(Base64.decode(it)) }
                                                ?: Optional.absent()
                                        }
                                        every { height } returns cleartextAttachment.height
                                        // use a v3 (string) remote id for purposes of this test... (v2 is a long)
                                        every { remoteId } returns SignalServiceAttachmentRemoteId(
                                            cleartextAttachment.id
                                        )
                                        every { key } returns Base64.decode(cleartextAttachment.key)
                                        every { size } returns Optional.fromNullable(cleartextAttachment.size)
                                        every { width } returns cleartextAttachment.width
                                        every { voiceNote } returns cleartextAttachment.voiceNote
                                    }
                                }
                            )
                        }
                    }


                    lateinit var sub: Job
                    beforeTest { sub = messageReceiver.subscribe(recipientAccount) }
                    afterTest {
                        sub.cancel()
                        deleteAllAttachments(app)
                    }

                    "reads the attachment to the filesystem and includes it in Cleartext sent to socket" {
                        eventually(timeout * 4, pollInterval) {
                            val path = try {
                                Path(app.signal.attachmentsPath, cleartextAttachment.filename)
                            } catch (_: Throwable) {
                                null
                            }
                            path?.fileSize()?.toInt() shouldBe cleartextAttachment.size

                            coVerify {
                                app.socketSender.send(
                                    cleartext(
                                        senderAddress.asSignalcAddress(),
                                        recipientAccount.asSignalcAddress(),
                                        cleartextBody,
                                        listOf(cleartextAttachment),
                                    )
                                )
                            }
                        }
                    }
                }
            }

            "when signal sends an envelope of type PREKEY_BUNDLE" - {
                val envelope = signalSendsEnvelopeOf(PREKEY_BUNDLE_VALUE)

                every {
                    anyConstructed<SignalServiceCipher>().decrypt(any())
                }  returns  mockk {
                    every { dataMessage.orNull() } returns null
                }

                lateinit var sub: Job
                beforeTest { sub = messageReceiver.subscribe(recipientAccount) }
                afterTest { sub.cancel() }

                "it is handled as CIPHERTEXT" {
                    eventually(timeout, pollInterval){
                        verify {
                            anyConstructed<SignalServiceCipher>().decrypt(envelope)
                        }
                    }
                }
            }
        }
    }
})
