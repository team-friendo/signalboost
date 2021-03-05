package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.model.SocketResponse
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genSignalServiceAddress
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genInt
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.cleartext
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.decryptionError
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.dropped
import info.signalboost.signalc.util.TimeUtil.nowInMillis
import io.kotest.core.spec.style.FreeSpec
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runBlockingTest
import org.signal.libsignal.metadata.ProtocolDuplicateMessageException
import org.whispersystems.signalservice.api.SignalServiceMessagePipe
import org.whispersystems.signalservice.api.SignalServiceMessageReceiver
import org.whispersystems.signalservice.api.crypto.SignalServiceCipher
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.*
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

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
            val jobDuration = 1.milliseconds

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

                "relays a DroppedMessage to the socket sender" {

                    messageReceiver.subscribe(recipientAccount).let {
                        delay(jobDuration)
                        it.cancel()
                    }
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

            "when signal sends an envelope of type CIPHERTEXT" - {
                signalSendsEnvelopeOf(CIPHERTEXT_VALUE)

                "and decryption succeeds" - {

                    val secretMessage = "a screaming comes across the sky..."

                    every {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    }  returns  mockk {
                        every { dataMessage.orNull() } returns mockk<SignalServiceDataMessage>{
                            every { expiresInSeconds } returns expiryTime
                            every { timestamp } returns now
                            every { body.orNull() } returns secretMessage
                        }
                    }

                    "relays Cleartext to socket sender" {
                        messageReceiver.subscribe(recipientAccount).let {
                            delay(10)
                            it.cancel()
                        }
                        coVerify {
                            app.socketSender.send(
                                cleartext(
                                    senderAddress.asSignalcAddress(),
                                    recipientAccount.asSignalcAddress(),
                                    secretMessage
                                )
                            )
                        }
                    }
                }

                "and message is empty" - {
                    every {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    }  returns  mockk {
                        every { dataMessage.orNull()?.body?.orNull() } returns null
                    }

                    "relays Empty to socket sender" {
                        messageReceiver.subscribe(recipientAccount).let {
                            delay(10)
                            it.cancel()
                        }
                        coVerify {
                            app.socketSender.send(SocketResponse.Empty)
                        }
                    }
                }

                "and decryption fails" - {
                    val error = ProtocolDuplicateMessageException(
                        Exception("oh no!"),
                        senderAddress.identifier,
                        42
                    )
                    every {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    }  throws error

                    "relays DecryptionError to socket sender" {
                        messageReceiver.subscribe(recipientAccount).let {
                            delay(10)
                            it.cancel()
                        }

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

            "when signal sends an envelope of type PREKEY_BUNDLE" - {
                val envelope = signalSendsEnvelopeOf(PREKEY_BUNDLE_VALUE)

                "it is handled as CIPHERTEXT" {
                    every {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    }  returns  mockk {
                        every { dataMessage.orNull() } returns null
                    }

                    messageReceiver.subscribe(recipientAccount).let {
                        delay(10)
                        it.cancel()
                    }

                    verify {
                        anyConstructed<SignalServiceCipher>().decrypt(envelope)
                    }
                }
            }
        }
    }
})
