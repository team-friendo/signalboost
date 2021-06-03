package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genDeviceId
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genSignalcAddress
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
import info.signalboost.signalc.util.KeyUtil.genRandomBytes
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
import java.io.IOException
import java.util.concurrent.TimeoutException
import kotlin.io.path.ExperimentalPathApi
import kotlin.io.path.Path
import kotlin.io.path.fileSize
import kotlin.time.Duration
import kotlin.time.ExperimentalTime

@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalReceiverTest : FreeSpec({
    runBlockingTest {
        val testScope = this
        val drainPollInterval = Duration.milliseconds(10)
        val drainTimeout = Duration.milliseconds(50)
        val config = Config.mockAllExcept(SignalReceiver::class).copy(
            timers = Config.default.timers.copy(
                drainPollInterval = drainPollInterval,
                drainTimeout = drainTimeout,
            )
        )

        val app = Application(config).run(testScope)
        val messageReceiver = app.signalReceiver

        val recipientAccount = genVerifiedAccount()
        // val senderAddress = genSignalServiceAddress()
        val senderAddress = genSignalcAddress()

        val timeout = Duration.milliseconds(40)
        val pollInterval = Duration.milliseconds(1)
        val now = nowInMillis()
        val expiryTime = genInt()

        fun signalSendsEnvelopeOf(
            envelopeType: Int,
            err: Throwable? = null
        ): Pair<SignalServiceEnvelope, SignalServiceMessagePipe> {
            val envelope = genEnvelope(
                type = envelopeType,
                sender = senderAddress.asSignalServiceAddress(),
            )

            val mockMessagePipe = mockk<SignalServiceMessagePipe> {
                err?.let {
                    every { read(any(), any()) } throws err
                } ?: run {
                    every { read(any(), any()) } returns envelope
                }
                every { shutdown() } returns Unit
            }

            every {
                anyConstructed<SignalServiceMessageReceiver>().createMessagePipe()
            } returns mockMessagePipe

            return Pair(envelope, mockMessagePipe)
        }

        fun signalSendsJunkEnvelopes() = signalSendsEnvelopeOf(UNKNOWN_VALUE)
        fun signalThrowsTimeout() =
            signalSendsEnvelopeOf(UNKNOWN_VALUE, TimeoutException("oh no, timeout!"))

        val ioException = IOException("oh no, io error!")
        fun signalThrowsIO() =
            signalSendsEnvelopeOf(UNKNOWN_VALUE, ioException)

        val mockDataMessage = mockk<SignalServiceDataMessage> {
            every { expiresInSeconds } returns expiryTime
            every { timestamp } returns now
            every { body.orNull() } returns null
            every { attachments.orNull() } returns null
            every { profileKey.orNull() } returns null
        }

        fun decryptionYields(cleartexts: List<String?>) =
            every {
                anyConstructed<SignalServiceCipher>().decrypt(any())
            } returns mockk {
                every { dataMessage.orNull() } returns mockDataMessage.apply {
                    every { body.orNull() } returnsMany cleartexts
                }
            }


        beforeSpec {
            mockkConstructor(SignalServiceMessageReceiver::class)
            mockkConstructor(SignalServiceCipher::class)
        }

        afterTest {
            messageReceiver.unsubscribe(recipientAccount.username)
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            deleteAllAttachments(app)
            unmockkAll()
            testScope.teardown()
        }

        "#drain" - {
            beforeTest {
                app.signalReceiver.messagesInFlight.set(3)
            }
            afterTest {
                app.signalReceiver.messagesInFlight.set(0)
            }

            "when all messages can be drained before timeout" - {
                "returns true and the number of messages drained" {
                    launch {
                        delay(drainPollInterval)
                        repeat(3) {
                            app.signalReceiver.messagesInFlight.getAndDecrement()
                        }
                    }
                    app.signalReceiver.drain() shouldBe Triple(true, 3, 0)
                }
            }

            "when all messages cannot be drained before timeout" - {
                "returns false and number messages remaining" {
                    launch {
                        delay(drainPollInterval)
                        app.signalReceiver.messagesInFlight.getAndDecrement()
                    }
                    app.signalReceiver.drain() shouldBe Triple(false, 3, 2)
                }
            }
        }

        "#subscribe" - {
            afterTest {
                messageReceiver.unsubscribe(recipientAccount.username)
            }

            "in all cases" - {
                signalSendsJunkEnvelopes()

                lateinit var sub: Job
                beforeTest {
                    sub = messageReceiver.subscribe(recipientAccount)!!
                }

                "creates a message pipe and listens for messages in a coroutine" {
                    messageReceiver.subscriptionCount shouldBe 1
                    messageReceiver.messagePipeCount shouldBe 1
                    sub.isActive shouldBe true
                }
            }

            "when signal connection times out" - {
                val (_, messagePipe) = signalThrowsTimeout()

                beforeTest {
                    messageReceiver.subscribe(recipientAccount)!!
                }

                "keeps reading from signal" {
                    verify(atLeast = 2) {
                        messagePipe.read(any(), any())
                    }
                }
            }

            "when signal connection has a connection error (caused by server)" - {
                val (_, messagePipe) = signalThrowsIO()

                lateinit var sub: Job
                beforeTest {
                    sub = messageReceiver.subscribe(recipientAccount)!!
                }

                "does not keep reading from signal" {
                    verify(exactly = 1) {
                        messagePipe.read(any(), any())
                    }
                }

                "unsubscribes the message receiver" {
                    eventually(timeout) {
                        sub.isCancelled shouldBe true
                    }
                }
            }

            "when signal connection has a connection error (caused by shutdown)" - {
                val (_, messagePipe) = signalThrowsIO()

                lateinit var sub: Job
                beforeTest {
                    app.isShuttingDown = true
                    sub = messageReceiver.subscribe(recipientAccount)!!
                }

                "does not keep reading from signal" {
                    verify(exactly = 1) {
                        messagePipe.read(any(), any())
                    }
                }

                "cancels the subscription" {
                    eventually(timeout) {
                        sub.isCancelled shouldBe true
                    }
                }
            }

            "when signal sends an envelope of type UNKNOWN" - {
                val (envelope) = signalSendsEnvelopeOf(UNKNOWN_VALUE)
                beforeTest {
                    messageReceiver.subscribe(recipientAccount)!!
                }

                "relays a DroppedMessage to the socket sender" {
                    eventually(timeout, pollInterval) {
                        coVerify {
                            app.socketSender.send(
                                dropped(
                                    senderAddress,
                                    recipientAccount.address,
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

                        "relays Cleartext to socket sender" {
                            messageReceiver.subscribe(recipientAccount)
                            eventually(timeout, pollInterval) {
                                coVerify {
                                    app.socketSender.send(
                                        cleartext(
                                            senderAddress,
                                            recipientAccount.address,
                                            cleartextBody
                                        )
                                    )
                                }
                            }
                        }

                        "increments and decrements a counter for tracking in-flight queue size"  {
                            mockkObject(app.signalReceiver.messagesInFlight).also {
                                every { app.signalReceiver.messagesInFlight.getAndIncrement() } returns 1
                                every { app.signalReceiver.messagesInFlight.getAndDecrement() } returns 0
                                every { app.signalReceiver.messagesInFlight.set(any()) } returns Unit
                            }
                            messageReceiver.subscribe(recipientAccount)

                            eventually(timeout, pollInterval) {
                                verify {
                                    app.signalReceiver.messagesInFlight.getAndIncrement()
                                    app.signalReceiver.messagesInFlight.getAndDecrement()
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
                                            senderAddress,
                                            recipientAccount.address,
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
                                    UntrustedIdentityException(recipientAccount.username, identityKey),
                                    senderAddress.asSignalServiceAddress().identifier,
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
                                                    senderAddress,
                                                    recipientAccount.address,
                                                    null,
                                                )
                                            )
                                        }
                                    }
                                }
                            }
                            "and does not have a fingerprint on the untrusted identity" - {
                                val untrustedIdentityError = ProtocolUntrustedIdentityException(
                                    UntrustedIdentityException(recipientAccount.username),
                                    senderAddress.asSignalServiceAddress().identifier,
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
                                                    senderAddress,
                                                    recipientAccount.address,
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
                                senderAddress.asSignalServiceAddress().identifier,
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
                                                senderAddress,
                                                recipientAccount.address,
                                                error
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                "containing a profile key update" - {
                    val fakeProfileKey = genRandomBytes(32)
                    every {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    } returns mockk {
                        every { dataMessage.orNull() } returns mockDataMessage.apply {
                            every { profileKey.orNull() } returns fakeProfileKey
                        }
                    }

                    "stores the profile key" {
                        messageReceiver.subscribe(recipientAccount)
                        eventually(timeout) {
                            coVerify {
                                app.contactStore.storeProfileKey(
                                    recipientAccount.address.identifier,
                                    senderAddress.identifier,
                                    fakeProfileKey,
                                )
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
                        filename = attachmentId,
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
                        every { dataMessage.orNull() } returns mockDataMessage.apply {
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
                                        senderAddress,
                                        recipientAccount.address,
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
                decryptionYields(listOf(null))

                "launches a job to refresh prekeys if necessary" {
                    messageReceiver.subscribe(recipientAccount)
                    eventually(timeout, pollInterval) {
                        coVerify {
                            app.accountManager.refreshPreKeysIfDepleted(recipientAccount)
                        }
                    }
                }

                "attempts to decrypt the envelope" {
                    messageReceiver.subscribe(recipientAccount)
                    eventually(timeout, pollInterval) {
                        coVerify {
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
                messageReceiver.unsubscribe(recipientAccount.username)

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
                val sub = messageReceiver.subscribe(recipientAccount)!!
                messageReceiver.unsubscribe(genVerifiedAccount().username)

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

        "#unsubscribeAll" - {
            signalSendsJunkEnvelopes()
            val sub1 = messageReceiver.subscribe(genVerifiedAccount())!!
            val sub2 = messageReceiver.subscribe(genVerifiedAccount())!!
            val sub3 = messageReceiver.subscribe(genVerifiedAccount())!!
            messageReceiver.unsubscribeAll()

            "unsubscribes all cached subscriptions" {
                messageReceiver.subscriptionCount shouldBe 0
                messageReceiver.messagePipeCount shouldBe 0
                listOf(sub1, sub2, sub3).forEach {
                    it.isCancelled shouldBe true
                }
            }
        }
    }
})
