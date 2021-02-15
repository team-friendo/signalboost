package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.Empty
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genSignalServiceAddress
import info.signalboost.signalc.testSupport.matchers.SocketOutMessageMatchers.cleartext
import info.signalboost.signalc.testSupport.matchers.SocketOutMessageMatchers.decryptionError
import info.signalboost.signalc.testSupport.matchers.SocketOutMessageMatchers.dropped
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
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.CIPHERTEXT_VALUE
import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.UNKNOWN_VALUE
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalMessageReceiverTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(SignalMessageReceiver::class)
        val app = Application(config).run(testScope)
        val messageReceiver = app.signalMessageReceiver

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
            // We cancel the `listen` job after a very short duration so we don't iterate
            // endlessly through the infinite `while` loop that calls `messagePipe#read`
            val jobDuration = 1.milliseconds

            fun signalSendsEnvelopeOf(envelopeType: Int): SignalServiceEnvelope {
                val mockEnvelope = mockk<SignalServiceEnvelope>() {
                    every { type } returns envelopeType
                    every { sourceAddress } returns senderAddress
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
                        app.socketMessageSender.send(
                            dropped(
                                senderAddress,
                                recipientAccount.address,
                                envelope
                            )
                        )
                    }
                }
            }

            "when signal sends an envelope of type CYPHERTEXT" - {
                signalSendsEnvelopeOf(CIPHERTEXT_VALUE)

                "and decryption succeeds" - {

                    val secretMessage = "a screaming comes across the sky..."

                    every {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    }  returns  mockk {
                        every { dataMessage.orNull()?.body?.orNull() } returns secretMessage
                    }

                    "relays Cleartext to socket sender" {
                        messageReceiver.subscribe(recipientAccount).let {
                            delay(10)
                            it.cancel()
                        }
                        coVerify {
                            app.socketMessageSender.send(
                                cleartext(
                                    senderAddress,
                                    recipientAccount.address,
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
                            app.socketMessageSender.send(Empty)
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
                            app.socketMessageSender.send(
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
})
