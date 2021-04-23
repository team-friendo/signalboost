package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.model.SocketResponse
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genDeviceId
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genSignalServiceAddress
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuid
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.dataGenerators.EnvelopeGen.genEnvelope
import info.signalboost.signalc.testSupport.dataGenerators.FileGen.deleteAllAttachments
import info.signalboost.signalc.testSupport.dataGenerators.FileGen.genJpegInputStream
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genInt
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genCleartextAttachment
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.cleartext
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.decryptionError
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.dropped
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.inboundIdentityFailure
import info.signalboost.signalc.util.KeyUtil
import info.signalboost.signalc.util.TimeUtil.nowInMillis
import io.kotest.assertions.timing.eventually
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runBlockingTest
import org.postgresql.util.Base64
import org.signal.libsignal.metadata.ProtocolDuplicateMessageException
import org.signal.libsignal.metadata.ProtocolUntrustedIdentityException
import org.whispersystems.libsignal.UntrustedIdentityException
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceMessagePipe
import org.whispersystems.signalservice.api.SignalServiceMessageReceiver
import org.whispersystems.signalservice.api.crypto.SignalServiceCipher
import org.whispersystems.signalservice.api.messages.SignalServiceAttachmentRemoteId
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.*
import java.util.*
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

        val recipientAccount = genVerifiedAccount()
        val senderAddress = genSignalServiceAddress()
        val cacheId = genUuid()

        val timeout = 40.milliseconds
        val pollInterval = 1.milliseconds
        val now = nowInMillis()
        val expiryTime = genInt()

        fun signalSendsEnvelopeOf(envelopeType: Int): Pair<SignalServiceEnvelope,SignalServiceMessagePipe> {
            val envelope = genEnvelope(
                type = envelopeType,
                sender = senderAddress,
            )

            val mockMessagePipe = mockk<SignalServiceMessagePipe> {
                every { read(any(), any(), any()) } answers {
                    this.thirdArg<SignalServiceMessagePipe.MessagePipeCallback>().onMessage(envelope)
                    envelope
                }
                every { shutdown() } returns Unit
            }

            every {
                anyConstructed<SignalServiceMessageReceiver>().createMessagePipe()
            }  returns  mockMessagePipe

            return Pair(envelope, mockMessagePipe)
        }

        fun signalSendsJunkEnvelopes() = signalSendsEnvelopeOf(UNKNOWN_VALUE)

        fun decryptionYields(cleartexts: List<String?>) =
            every {
                anyConstructed<SignalServiceCipher>().decrypt(any())
            } returns mockk {
                every { dataMessage.orNull() } returns mockk {
                    every { expiresInSeconds } returns expiryTime
                    every { timestamp } returns now
                    every { body.orNull() } returnsMany cleartexts
                    every { attachments.orNull() } returns null
                }
            }


        beforeSpec {
            mockkConstructor(SignalServiceMessageReceiver::class)
            mockkConstructor(SignalServiceCipher::class)
        }

        afterTest {
            messageReceiver.unsubscribe(recipientAccount)
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            deleteAllAttachments(app)
            unmockkAll()
            testScope.teardown()
        }

        "#subscribe" - {
            afterTest {
                messageReceiver.unsubscribe(recipientAccount)
            }

            "in all cases" - {
                val (junkEnvelope) = signalSendsJunkEnvelopes()
                coEvery {
                    app.envelopeStore.create(recipientAccount.username, junkEnvelope)
                } returns cacheId

                lateinit var sub: Job
                beforeTest {
                    sub = messageReceiver.subscribe(recipientAccount)!!
                }

                "attempts to retrieve cached envelopes from previous subscriptions" {
                    coVerify {
                        app.envelopeStore.findAll(recipientAccount.username)
                    }
                }

                "creates a message pipe and listens for messages in a coroutine" {
                    messageReceiver.subscriptionCount shouldBe 1
                    messageReceiver.messagePipeCount shouldBe 1
                    sub.isActive shouldBe true
                }

                "caches each envelope it receives before attempting decryption" {
                    verify {
                        app.envelopeStore.create(recipientAccount.username, junkEnvelope)
                    }
                }

                "deletes the cached envelope after attempting decryption" {
                    coVerify {
                        app.envelopeStore.delete(cacheId)
                    }
                }
            }

            "when the recipient account has cached (unprocessed) envelopes" - {
                coEvery {
                    app.envelopeStore.findAll(recipientAccount.username)
                } returns List(3) { genEnvelope(type = CIPHERTEXT_VALUE) }
                decryptionYields(listOf("msg1", "msg2", "msg3"))
                signalSendsJunkEnvelopes()

                "dispatches cached envelopes before processing new messages" {
                    messageReceiver.subscribe(recipientAccount)!!
                    eventually(timeout, pollInterval) {
                        coVerifyOrder {
                            app.socketSender.send(cleartext(body = "msg1"))
                            app.socketSender.send(cleartext(body ="msg2"))
                            app.socketSender.send(cleartext(body ="msg3"))
                            app.socketSender.send(any<SocketResponse.Dropped>())
                        }
                    }
                }
            }

            "when signal sends an envelope of type UNKNOWN" - {
                val (envelope) = signalSendsEnvelopeOf(UNKNOWN_VALUE)
                messageReceiver.subscribe(recipientAccount)!!

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
                        decryptionYields(listOf(cleartextBody))
                        messageReceiver.subscribe(recipientAccount)

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
                        decryptionYields(listOf<String?>(null))

                        "relays empty message to socket sender" {
                            messageReceiver.subscribe(recipientAccount)
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
                        "and is an untrusted identity exception" - {
                            "and has a fingerprint on the untrusted identity" - {
                                val identityKey = KeyUtil.genIdentityKeyPair().publicKey
                                val untrustedIdentityError = ProtocolUntrustedIdentityException(
                                    UntrustedIdentityException("", identityKey),
                                    senderAddress.identifier,
                                    genDeviceId()
                                )
                                every {
                                    anyConstructed<SignalServiceCipher>().decrypt(any())
                                } throws untrustedIdentityError

                                beforeTest { messageReceiver.subscribe(recipientAccount)!! }

                                "relays InboundIdentityFailure to socket sender" {
                                    eventually(timeout, pollInterval) {
                                        coVerify {
                                            app.socketSender.send(
                                                inboundIdentityFailure(
                                                    senderAddress.asSignalcAddress(),
                                                    recipientAccount.asSignalcAddress(),
                                                    identityKey.fingerprint
                                                )
                                            )
                                        }
                                    }
                                }
                            }
                            "and does not have a fingerprint on the untrusted identity" - {
                                val identityKey = KeyUtil.genIdentityKeyPair().publicKey
                                val untrustedIdentityError = ProtocolUntrustedIdentityException(
                                    UntrustedIdentityException(recipientAccount.username),
                                    senderAddress.identifier,
                                    genDeviceId()
                                )
                                every {
                                    anyConstructed<SignalServiceCipher>().decrypt(any())
                                } throws untrustedIdentityError

                                beforeTest { messageReceiver.subscribe(recipientAccount)!! }

                                "relays InboundIdentityFailure to socket sender" {
                                    eventually(timeout, pollInterval) {
                                        coVerify {
                                            app.socketSender.send(
                                                inboundIdentityFailure(
                                                    senderAddress.asSignalcAddress(),
                                                    recipientAccount.asSignalcAddress(),
                                                    null
                                                )
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        "and is a non specified exception" - {
                            val error = ProtocolDuplicateMessageException(
                                Exception("FAKE ERROR! oh no!"),
                                senderAddress.identifier,
                                42
                            )
                            every {
                                anyConstructed<SignalServiceCipher>().decrypt(any())
                            } throws error

                            beforeTest { messageReceiver.subscribe(recipientAccount)!! }

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
                }

                "when caching envelope fails" - {
                    every {
                        app.envelopeStore.create(any(),any())
                    } throws Error("oh noes!")
                    decryptionYields(listOf("hello", "world"))
                    messageReceiver.subscribe(recipientAccount)!!

                    "does not disrupt message listening loop" {
                        eventually(timeout, pollInterval) {
                            coVerifyOrder {
                                app.socketSender.send(cleartext(body = "hello"))
                                app.socketSender.send(cleartext(body = "world"))
                            }
                        }
                    }
                    "does not try to delete cache entry" {
                        coVerify(exactly = 0) {
                            app.envelopeStore.delete(any())
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



                    afterTest {
                        deleteAllAttachments(app)
                    }

                    "reads the attachment to the filesystem and includes it in Cleartext sent to socket" {
                        messageReceiver.subscribe(recipientAccount)
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
                val (envelope) = signalSendsEnvelopeOf(PREKEY_BUNDLE_VALUE)

                every {
                    anyConstructed<SignalServiceCipher>().decrypt(any())
                }  returns  mockk {
                    every { dataMessage.orNull() } returns null
                }

                "it is handled as CIPHERTEXT" {
                    messageReceiver.subscribe(recipientAccount)
                    eventually(timeout, pollInterval){
                        verify {
                            anyConstructed<SignalServiceCipher>().decrypt(envelope)
                        }
                    }
                }
            }

            "when issued for an account that is already subscribed" - {
                signalSendsJunkEnvelopes()
                messageReceiver.subscribe(recipientAccount)!!

                "does not create a new subscription" {
                    messageReceiver.subscribe(recipientAccount) shouldBe null
                    messageReceiver.subscriptionCount shouldBe 1
                    verify(exactly = 1) {
                        anyConstructed<SignalServiceMessageReceiver>().createMessagePipe()
                    }
                }
            }
        }

        "#unsubscribe" - {
            val (_, messagePipe) = signalSendsJunkEnvelopes()

            "when issued for a subscribed account" - {
                val sub = messageReceiver.subscribe(recipientAccount)!!
                messageReceiver.unsubscribe(recipientAccount)

                "shuts down message pipe" {
                    verify {
                        messagePipe.shutdown()
                    }
                }

                "cancels listening coroutine" {
                    sub.isCancelled shouldBe true
                }

                "removes account from caches" {
                    messageReceiver.subscriptionCount shouldBe 0
                    messageReceiver.messagePipeCount shouldBe 0
                }
            }

            "when issued for a non-subscribed account" - {
                val sub =messageReceiver.subscribe(recipientAccount)!!
                messageReceiver.unsubscribe(genVerifiedAccount())

                "does nothing" {
                    verify(exactly = 0) {
                        messagePipe.shutdown()
                    }
                    sub.isActive shouldBe true
                    messageReceiver.subscriptionCount shouldBe 1
                    messageReceiver.messagePipeCount shouldBe 1
                }
            }
        }
    }
})
