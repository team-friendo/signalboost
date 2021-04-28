package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.exception.SignalcCancellation
import info.signalboost.signalc.exception.SignalcError
import info.signalboost.signalc.model.SendResultType
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.model.SocketResponse
import info.signalboost.signalc.store.ProtocolStore
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genNewAccount
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genRegisteredAccount
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genAbortRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genIsAliveRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genRegisterRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSetExpiration
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSubscribeRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genTrustRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genUnsubscribeRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genVerifyRequest
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genSocketPath
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.registrationError
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.requestHandlingError
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.sendSuccess
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.subscriptionDisrupted
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.subscriptionFailed
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.subscriptionSuccess
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.trustSuccess
import info.signalboost.signalc.testSupport.socket.TestSocketClient
import info.signalboost.signalc.testSupport.socket.TestSocketServer
import info.signalboost.signalc.util.KeyUtil
import info.signalboost.signalc.util.StringUtil.asSanitizedCode
import info.signalboost.signalc.util.TimeUtil
import io.kotest.assertions.timing.eventually
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runBlockingTest
import org.whispersystems.signalservice.api.push.exceptions.CaptchaRequiredException
import java.io.IOException
import java.net.Socket
import java.time.Instant
import kotlin.io.path.ExperimentalPathApi
import kotlin.io.path.Path
import kotlin.io.path.deleteIfExists
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds


@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketReceiverTest : FreeSpec({
    runBlockingTest {
        val testScope = this
        val serverScope = genTestScope()
        val config = Config.mockAllExcept(SocketReceiver::class)
        val app = Application(config).run(testScope)

        val senderPhoneNumber = genPhoneNumber()
        val newSenderAccount = genNewAccount(senderPhoneNumber)
        val registeredSenderAccount = genRegisteredAccount(senderPhoneNumber)
        val verifiedSenderAccount = genVerifiedAccount(senderPhoneNumber)
        val recipientPhoneNumber = genPhoneNumber()
        val recipientAccount = genVerifiedAccount(recipientPhoneNumber)

        val now = Instant.now().toEpochMilli()
        val timeout = 500.milliseconds

        val socketPath = genSocketPath()
        val socketServer = TestSocketServer.run(socketPath, serverScope)

        lateinit var client: TestSocketClient
        lateinit var socket: Socket
        lateinit var listenJob: Job

        beforeSpec {
            mockkObject(TimeUtil).also {
                every { TimeUtil.nowInMillis() } returns now
            }
        }
        beforeTest{
            client = TestSocketClient.connect(socketPath, testScope)
            socket = socketServer.receive()
            listenJob = app.socketReceiver.connect(socket)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            socketServer.close()
            Path(socketPath).deleteIfExists()
            testScope.teardown()
            serverScope.teardown()
            unmockkAll()
        }

        "handling connections" - {
            afterTest {
                client.close()
            }

            "opens a reader on a socket and stores a reference to it" {
                app.socketReceiver.readers[socket.hashCode()] shouldNotBe null
                app.socketReceiver.close(socket.hashCode())
            }
        }

        "handling connection terminations" - {
            "when client terminates socket connection"  {
                client.close()

                listenJob.invokeOnCompletion {
                    app.socketReceiver.readers[socket.hashCode()] shouldBe null
                    coVerify {
                        app.socketServer.close(socket.hashCode())
                    }
                }
            }

            "when server calls #close"  {
                app.socketReceiver.close(socket.hashCode())

                listenJob.invokeOnCompletion {
                    app.socketReceiver.readers[socket.hashCode()] shouldBe null
                    coVerify {
                        app.socketServer.close(socket.hashCode())
                    }
                }
            }
        }

        "handling requests" - {
            afterTest {
                client.close()
            }

            "ABORT request" - {
                val request = genAbortRequest()
                beforeTest {
                    mockkObject(Application.Exit)
                    every { Application.Exit.process(any(), any()) } returns null
                }

                "shuts down the app" {
                    client.send(request.toJson())
                    eventually(timeout) {
                        verify {
                            Application.Exit.process(0,false)
                        }
                    }
                }
            }

            "IS_ALIVE request" - {
                val request = genIsAliveRequest()

                "echoes the request back to socket" {
                    client.send(request.toJson())
                    eventually(timeout) {
                        coVerify {
                            app.socketSender.send(SocketResponse.IsAlive(request.id))
                        }
                    }
                }
            }

            "REGISTER request" - {
                val request = genRegisterRequest(username = senderPhoneNumber)

                "when account is NEW" - {
                    coEvery { app.accountManager.load(senderPhoneNumber) } returns newSenderAccount

                    "sends registration request to signal" - {
                        coEvery {
                            app.accountManager.register(newSenderAccount)
                        } returns mockk()

                        client.send(request.toJson())
                        eventually(timeout) {
                            coVerify {
                                app.accountManager.register(newSenderAccount, request.captcha)
                            }
                        }
                    }

                    "when registration succeeds" - {
                        coEvery {
                            app.accountManager.register(newSenderAccount, request.captcha)
                        } returns registeredSenderAccount

                        "sends registration success response to socket" {
                            client.send(request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.RegistrationSuccess.of(request)
                                    )
                                }
                            }
                        }
                    }

                    "when registration fails" - {
                        val _request = request.copy(captcha = null)
                        val error = CaptchaRequiredException()
                        coEvery {
                            app.accountManager.register(newSenderAccount, null)
                        } throws error

                        "sends registration error response to socket" {
                            client.send(_request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.RegistrationError.of(_request, error)
                                    )
                                }
                            }
                        }
                    }
                }

                "when account is REGISTERED or VERIFIED" - {
                    coEvery {
                        app.accountManager.load(senderPhoneNumber)
                    } returnsMany listOf(
                        registeredSenderAccount,
                        verifiedSenderAccount,
                    )

                    "it sends registration error response to socket" {
                        repeat(2) {
                            client.send(request.toJson())
                        }

                        eventually(timeout) {
                            coVerify(exactly = 2) {
                                app.socketSender.send(
                                    registrationError(
                                        id = request.id,
                                        data = SocketResponse.UserData(senderPhoneNumber),
                                        error = SignalcError.RegistrationOfRegsisteredUser,
                                    )
                                )
                            }
                        }
                    }
                }
            }

            "SEND request" - {
                val messageBody = "hi there"
                val sendRequest = genSendRequest(
                    username = verifiedSenderAccount.username,
                    recipientAddress = recipientAccount.address.asSignalcAddress(),
                    messageBody = messageBody,
                )
                val sendRequestJson = sendRequest.toJson()

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns verifiedSenderAccount

                    "sends signal message" {
                        client.send(sendRequest.toJson())
                        eventually(timeout) {
                            coVerify {
                                app.signalSender.send(
                                    verifiedSenderAccount,
                                    recipientAccount.address,
                                    messageBody,
                                    any(),
                                    any(),
                                    any(),
                                )
                            }
                        }
                    }

                    "when sending signal message succeeds" - {
                        coEvery {
                            app.signalSender.send(any(), any(), any(), any(), any(), any())
                        } returns mockk {
                            every { success } returns mockk()
                        }

                        "sends success message to socket" {
                            client.send(sendRequestJson)
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(sendSuccess(sendRequest))
                                }
                            }
                        }
                    }

                    "when sending signal message throws" - {
                        val error = Throwable("arbitrary error!")
                        coEvery {
                            app.signalSender.send(any(), any(), any(), any(), any(), any())
                        } throws error

                        "sends error message to socket" {
                            client.send(sendRequestJson)
                            eventually(timeout) {
                                coVerify {
                                    // TODO(aguestuser|2021-02-04): we dont' actually want this.
                                    //  we want halting errors to be treated like SendResult statuses below!
                                    app.socketSender.send(
                                        requestHandlingError(sendRequest, error)
                                    )
                                }
                            }
                        }
                    }

                    "when sending signal message returns failure status" - {
                        coEvery {
                            app.signalSender.send(any(), any(), any(), any(), any(), any())
                        } returns mockk {
                            every { success } returns null
                            every { isNetworkFailure } returns true
                        }

                        "sends error message to socket" {
                            client.send(sendRequestJson)
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.SendResults.networkFailure(sendRequest)
                                    )
                                }
                            }
                        }
                    }

                    "when sending signal message returns identity failure" - {
                        val newIdentityKey = KeyUtil.genIdentityKeyPair().publicKey
                        coEvery {
                            app.signalSender.send(any(), any(), any(), any(), any(), any())
                        } returns mockk {
                            every { success } returns null
                            every { isNetworkFailure } returns false
                            every { isUnregisteredFailure } returns false
                            every { identityFailure } returns mockk {
                                every { identityKey } returns newIdentityKey
                            }
                        }

                        val mockProtocolStore = mockk<ProtocolStore.AccountProtocolStore> {
                            every { saveFingerprintForAllIdentities(any(), any()) } returns 1
                        }

                        every {
                            app.protocolStore.of(verifiedSenderAccount)
                        } returns mockProtocolStore

                        "sends error message to socket" {
                            client.send(sendRequestJson)
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.SendResults.identityFailure(sendRequest, newIdentityKey.fingerprint)
                                    )
                                }
                            }
                        }

                        "saves the new identity key" {
                            client.send(sendRequestJson)
                            eventually(timeout) {
                                verify {
                                   mockProtocolStore.saveFingerprintForAllIdentities(
                                       recipientAccount.address,
                                       newIdentityKey.serialize(),
                                   )
                                }
                            }
                        }
                    }
                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error message to socket" {
                        client.send(sendRequestJson)
                        eventually(timeout) {
                            coVerify {
                                app.socketSender.send(
                                    requestHandlingError(
                                        sendRequest,
                                        Error("Can't send to $senderPhoneNumber: not registered.")
                                    )
                                )
                            }
                        }
                    }
                }
            }

            "SET_EXPIRATION request" - {
                val request = genSetExpiration(
                    username = verifiedSenderAccount.username,
                    recipientAddress = recipientAccount.address.asSignalcAddress(),
                    expiresInSeconds = 60,
                )

                "when sender account is verified" - {
                    coEvery { app.accountManager.loadVerified(request.username) } returns verifiedSenderAccount

                    "attempts to set expiration timer with recipient" {
                        client.send(request.toJson())
                        eventually(timeout) {
                            coVerify {
                                app.signalSender.setExpiration(
                                    verifiedSenderAccount,
                                    recipientAccount.address,
                                    60,
                                )
                            }
                        }
                    }

                    "when setting expiration succeeds" - {
                        "sends success message to socket" {
                            client.send(request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(SocketResponse.SetExpirationSuccess.of(request))
                                }
                            }
                        }
                    }

                    "when setting expiration fails" - {
                        coEvery {
                            app.signalSender.setExpiration(any(),any(),any())
                        } returns mockk {
                            every { success } returns null
                            every { isNetworkFailure } returns true
                        }

                        "sends failure message to socket" {
                            client.send(request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.SetExpirationFailed.of(request, SendResultType.NETWORK_FAILURE)
                                    )
                                }
                            }
                        }
                    }
                }

                "when sender account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "does not attempt to set expiration timer with recipient" {
                        client.send(request.toJson())
                        coVerify(exactly = 0) {
                            app.signalSender.setExpiration(
                                any(),
                                any(),
                                any(),
                            )
                        }
                    }

                    "sends error message to socket" {
                        client.send(request.toJson())
                        eventually(timeout) {
                            coVerify {
                                app.socketSender.send(
                                    requestHandlingError(
                                        request,
                                        Error("Can't send to $senderPhoneNumber: not registered.")
                                    )
                                )
                            }
                        }
                    }
                }
            }

            "SUBSCRIBE request" - {
                val request = genSubscribeRequest(recipientAccount.username)
                val requestJson = request.toJson()

                "when account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns recipientAccount

                    "when subscription succeeds" - {
                        coEvery {
                            app.signalReceiver.subscribe(recipientAccount)
                        } returns Job()

                        "sends success to socket" {
                            client.send(requestJson)
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        subscriptionSuccess(request.id, request.username)
                                    )
                                }
                            }
                        }
                    }

                    "when message pipe from signal cannot be initiated" - {
                        val error = SignalcError.MessagePipeNotCreated(IOException("whoops!"))
                        val subscribeJob = Job()
                        coEvery {
                            app.signalReceiver.subscribe(recipientAccount)
                        } returns subscribeJob

                        "sends error to socket" {
                            client.send(requestJson)
                            subscribeJob.cancel(error.message!!, error)
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        subscriptionFailed(request.id, error)
                                    )
                                }
                            }
                        }
                    }

                    "when connection to signal is broken" - {
                        val error = IOException("whoops!")
                        val disruptedJob = Job()
                        coEvery {
                            app.signalReceiver.subscribe(recipientAccount)
                        } returnsMany listOf(disruptedJob, Job())

                        "sends error to socket and resubscribes" {
                            client.send(requestJson)
                            disruptedJob.cancel(error.message!!, error)

                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        subscriptionDisrupted(request.id, error)
                                    )
                                }

                                coVerify(atLeast = 2) {
                                    app.signalReceiver.subscribe(recipientAccount)
                                }
                            }
                        }
                    }

                    "when subscription is purposefully cancelled by client" - {
                        val sub = Job()
                        coEvery {
                            app.signalReceiver.subscribe(recipientAccount)
                        } returns sub

                        client.send(requestJson)
                        sub.cancel(SignalcCancellation.SubscriptionCancelled)
                        delay(40.milliseconds)

                        "does not attempt to resubscribe".config(invocations = 3) {
                            coVerify(exactly = 1) {
                                app.signalReceiver.subscribe(recipientAccount)
                            }
                        }
                    }
                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error to socket" {
                        client.send(requestJson)
                        eventually(timeout) {
                            coVerify {
                                app.socketSender.send(
                                    subscriptionFailed(
                                        request.id,
                                        SignalcError.SubscriptionOfUnregisteredUser,
                                    )
                                )
                            }
                        }
                    }
                }
            }

            "TRUST request" - {
                val request = genTrustRequest(recipientAccount.username)
                val requestJson = request.toJson()

                "account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns recipientAccount
                    coEvery {
                        app.protocolStore.of(recipientAccount).trustFingerprintForAllIdentities(any())
                    } returns 1

                    "attempts to trust the correct fingerprint" {
                        client.send(requestJson)
                        eventually(timeout) {
                            coVerify {
                                app.protocolStore.of(recipientAccount).trustFingerprintForAllIdentities(request.fingerprint.toByteArray())
                            }
                        }
                    }

                    "when trust fingerprint succeeds" - {
                        "sends success to socket" {
                            client.send(requestJson)
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        trustSuccess(request)
                                    )
                                }
                            }
                        }
                    }

                    "when trust fingerprint fails" - {
                        "sends success to socket" {
                            client.send(requestJson)
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        trustSuccess(request)
                                    )
                                }
                            }
                        }
                    }
                }
                "account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "does not attempt to trust the fingerprint" {
                        client.send(requestJson)
                        eventually(timeout) {
                            coVerify(exactly = 0) {
                                app.protocolStore.of(recipientAccount).trustFingerprintForAllIdentities(request.fingerprint.toByteArray())
                            }
                        }
                    }

                    "sends error to socket" {
                        client.send(requestJson)
                        eventually(timeout) {
                            coVerify {
                                app.socketSender.send(
                                    requestHandlingError(
                                        request,
                                        Error("Can't send to ${request.username}: not registered.")
                                    )
                                )
                            }
                        }
                    }
                }
            }

            "UNSUBSCRIBE request" - {
                val request = genUnsubscribeRequest(username = recipientPhoneNumber)

                "when account is verified" - {
                    coEvery {
                        app.accountManager.loadVerified(recipientPhoneNumber)
                    } returns verifiedSenderAccount

                    "when unsubscribe succeeds" - {
                        coEvery { app.signalReceiver.unsubscribe(any()) } returns Unit

                        "sends success to socket" {
                            client.send(request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.UnsubscribeSuccess(request.id, request.username)
                                    )
                                }
                            }
                        }
                    }

                    "when unsubscribe fails" - {
                        val error = IOException("whoops!")
                        coEvery { app.signalReceiver.unsubscribe(any()) } throws error

                        "sends failure to socket" {
                            client.send(request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.UnsubscribeFailure(request.id, error)
                                    )
                                }
                            }
                        }
                    }
                }

                "when account is not verified" - {
                    coEvery {
                        app.accountManager.loadVerified(recipientPhoneNumber)
                    } returns null

                    "does not attempt to unsubscribe" {
                        client.send(request.toJson())
                        coVerify(exactly = 0) {
                            app.signalReceiver.unsubscribe(any())
                        }
                    }

                    "sends failure to socket" {
                        client.send(request.toJson())
                        eventually(timeout) {
                            coVerify {
                                app.socketSender.send(
                                    SocketResponse.UnsubscribeFailure(request.id, SignalcError.UnsubscribeUnregisteredUser)
                                )
                            }
                        }
                    }
                }
            }

            "VERIFY request" - {
                val request = genVerifyRequest(username = senderPhoneNumber)

                "when account is REGISTERED" - { // attempts verification
                    coEvery {
                        app.accountManager.load(senderPhoneNumber)
                    } returns registeredSenderAccount

                    "sanitizes verification code and submits it to signal" {
                        coEvery { app.accountManager.verify(any(), any())} returns mockk()

                        client.send(request.toJson())
                        eventually(timeout) {
                            coVerify {
                                app.accountManager.verify(
                                    registeredSenderAccount,
                                    request.code.replace("-", "")
                                )
                            }
                        }
                    }

                    "when verification succeeds" - {
                        coEvery {
                            app.accountManager.verify(registeredSenderAccount, request.code.asSanitizedCode())
                        } returns verifiedSenderAccount

                        coEvery {
                            app.accountManager.publishPreKeys(any())
                        } returns verifiedSenderAccount

                        "publishes prekeys for verified account" {
                            client.send(request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.accountManager.publishPreKeys(verifiedSenderAccount)
                                }
                            }
                        }

                        "sends registration success response to socket" {
                            client.send(request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.VerificationSuccess.of(request)
                                    )
                                }
                            }
                        }
                    }

                    "when verification throws" - {
                        val error = Error("BOOM!")
                        coEvery {
                            app.accountManager.verify(registeredSenderAccount, request.code.asSanitizedCode())
                        } throws error

                        "sends registration error response to socket" {
                            client.send(request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.VerificationError.of(request, error)
                                    )
                                }
                            }
                        }
                    }

                    "when verification submits incorrect code" - {
                        val error = Error("BOOM!")
                        coEvery {
                            app.accountManager.verify(registeredSenderAccount, request.code.asSanitizedCode())
                        } throws error

                        "sends registration error response to socket" {
                            client.send(request.toJson())
                            eventually(timeout) {
                                coVerify {
                                    app.socketSender.send(
                                        SocketResponse.VerificationError.of(request, error)
                                    )
                                }
                            }
                        }
                    }
                }

                "when account is NEW or VERIFIED" - {
                    coEvery {
                        app.accountManager.load(senderPhoneNumber)
                    } returnsMany listOf(
                        newSenderAccount,
                        verifiedSenderAccount,
                    )

                    "it sends registration error response to socket" {
                        client.send(request.toJson())
                        client.send(request.toJson())
                        eventually(timeout) {
                            coVerify {
                                app.socketSender.send(
                                    SocketResponse.VerificationError.of(
                                        request,
                                        SignalcError.VerificationOfNewUser
                                    )
                                )
                            }
                        }
                        eventually(timeout) {
                            coVerify {
                                app.socketSender.send(
                                    SocketResponse.VerificationError.of(
                                        request,
                                        SignalcError.VerificationOfVerifiedUser
                                    )
                                )
                            }
                        }
                    }
                }
            }
        }
    }
})
