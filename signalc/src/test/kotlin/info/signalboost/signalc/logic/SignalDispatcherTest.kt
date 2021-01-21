package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.fixtures.Account.genVerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.Address.genSignalServiceAddress
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import io.mockk.MockKAnnotations.init
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runBlockingTest
import org.signal.libsignal.metadata.ProtocolUntrustedIdentityException
import org.whispersystems.libsignal.UntrustedIdentityException
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.crypto.SignalServiceCipher
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.CIPHERTEXT_VALUE
import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.UNKNOWN_VALUE

@ExperimentalCoroutinesApi
class SignalDispatcherTest : FreeSpec({

    runBlockingTest {

        beforeSpec {
            mockkConstructor(SignalServiceCipher::class)
        }

        lateinit var signalDispatcher: SignalDispatcher
        lateinit var incomingMessages: Channel<SignalServiceEnvelope>

        beforeTest {
            val app = Application(Config.test, this)

            incomingMessages = Channel<SignalServiceEnvelope>()
            val mockMessageReceiver = mockk<MessageReceiver>() {
                coEvery { receiveMessages(any()) } returns incomingMessages
            }
            signalDispatcher = SignalDispatcher(app, mockMessageReceiver)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            unmockkAll()
        }


        "#subscribe" - {
            val sender = genSignalServiceAddress()
            val recipient = genVerifiedAccount()

            "when handling cyphertext message" - {
                val mockCyphertextEnvelope = mockk<SignalServiceEnvelope> {
                    every { type } returns CIPHERTEXT_VALUE
                    every { sourceAddress } returns sender
                }

                "and decryption succeeds" - {
                    val cleartext = "a screaming came across the sky"
                    coEvery {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    } returns mockk() {
                        every { dataMessage } returns Optional.of(mockk {
                            every { body } returns Optional.of(cleartext)
                        })
                    }

                    "emits cleartext on channel" {
                        launch {
                            val outgoingMessages = signalDispatcher.subscribe(recipient)
                            incomingMessages.send(mockCyphertextEnvelope)

                            outgoingMessages.receive() shouldBe
                                Cleartext(sender, recipient.address, cleartext)
                        }
                    }
                }

                "and message is empty" - {
                    coEvery {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    } returns mockk() {
                        every { dataMessage } returns Optional.absent()
                    }

                    "emits empty message on channel" {
                        launch {
                            val outgoingMessages = signalDispatcher.subscribe(recipient)
                            incomingMessages.send(mockCyphertextEnvelope)

                            outgoingMessages.receive() shouldBe
                                EmptyMessage(sender, recipient.address)
                        }
                    }
                }

                "and decryption fails" - {
                    val error = ProtocolUntrustedIdentityException(
                        UntrustedIdentityException(sender.identifier, KeyUtil.genIdentityKeyPair().publicKey),
                        sender.identifier,
                        42,
                    )
                    coEvery {
                        anyConstructed<SignalServiceCipher>().decrypt(any())
                    } throws error

                    "emits wrapped error on channel" {
                        launch {
                            val outgoingMessages = signalDispatcher.subscribe(recipient)
                            incomingMessages.send(mockCyphertextEnvelope)

                            outgoingMessages.receive() shouldBe
                                DecryptionError(sender, recipient.address, error)
                        }
                    }
                }
            }

            "when handling messages of unkonwn type" - {
                val mockUnkownEnvelope = mockk<SignalServiceEnvelope> {
                    every { type } returns UNKNOWN_VALUE
                    every { sourceAddress } returns sender
                }

                "drops the message" {
                    launch {
                        val outGoingMessages = signalDispatcher.subscribe(recipient)
                        incomingMessages.send(mockUnkownEnvelope)

                        outGoingMessages.receive() shouldBe
                            DroppedMessage(sender, recipient.address, mockUnkownEnvelope)
                    }
                }
            }
        }
    }
})
