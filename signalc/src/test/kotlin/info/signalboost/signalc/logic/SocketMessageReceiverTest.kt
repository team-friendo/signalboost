package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.error.SignalcError
import info.signalboost.signalc.model.*
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.AccountGen.genNewAccount
import info.signalboost.signalc.testSupport.fixtures.AccountGen.genRegisteredAccount
import info.signalboost.signalc.testSupport.fixtures.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.NumGen.genInt
import info.signalboost.signalc.testSupport.fixtures.NumGen.genLong
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genAbortRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genCloseRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genRegisterRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSubscribeRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genVerifyRequest
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.registrationError
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.requestHandlingError
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.sendSuccess
import info.signalboost.signalc.testSupport.socket.TestSocketClient
import info.signalboost.signalc.testSupport.socket.TestSocketServer
import info.signalboost.signalc.util.*
import info.signalboost.signalc.util.StringUtil.asSanitizedCode
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
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds


@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketMessageReceiverTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val serverScope = genTestScope()
        val config = Config.mockAllExcept(SocketMessageReceiver::class)
        val app = Application(config).run(testScope)

        val senderPhoneNumber = genPhoneNumber()
        val newSenderAccount = genNewAccount(senderPhoneNumber)
        val registeredSenderAccount = genRegisteredAccount(senderPhoneNumber)
        val verifiedSenderAccount = genVerifiedAccount(senderPhoneNumber)
        val recipientAccount = genVerifiedAccount()

        val now = Instant.now().toEpochMilli()
        val connectDelay = 5.milliseconds
        val closeDelay = 20.milliseconds

        val socketPath = app.config.socket.path
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
            listenJob = app.socketMessageReceiver.connect(socket)
            delay(connectDelay)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            socketServer.close()
            testScope.teardown()
            serverScope.teardown()
            unmockkAll()
        }

        fun verifyClosed(socket: Socket) {
            app.socketMessageReceiver.readers[socket.hashCode()] shouldBe null
            coVerify {
                app.socketServer.close(socket.hashCode())
            }
        }

        "handling connections" - {
            afterTest{
                client.close()
            }

            "opens a reader on a socket and stores a reference to it" {
                app.socketMessageReceiver.readers[socket.hashCode()] shouldNotBe null
                app.socketMessageReceiver.close(socket.hashCode())
            }
        }

        "handling messages" - {
            afterTest{
                client.close()
            }

            "ABORT request" - {
                "shuts down the app" {
                    client.send(genAbortRequest().toJson(), wait = closeDelay)
                    coVerify {
                        app.socketMessageSender.send(any<SocketResponse.AbortWarning>())
                        app.socketServer.stop()
                    }
                }
            }

            "REGISTER request" - {
                val request = genRegisterRequest(username = senderPhoneNumber)
                val transmitDelay = 10.milliseconds

                "when account is NEW" - {
                    coEvery { app.accountManager.load(senderPhoneNumber) } returns newSenderAccount

                    "sends registration request to signal" - {
                        coEvery {
                            app.accountManager.register(newSenderAccount)
                        } returns mockk()

                        client.send(request.toJson(), wait = transmitDelay)
                        coVerify {
                            app.accountManager.register(newSenderAccount, request.captcha)
                        }
                    }

                    "when registration succeeds" - {
                        coEvery {
                            app.accountManager.register(newSenderAccount, request.captcha)
                        } returns registeredSenderAccount

                        "sends registration success response to socket" {
                            client.send(request.toJson(), wait = transmitDelay)
                            coVerify {
                                app.socketMessageSender.send(
                                    SocketResponse.RegistrationSuccess.of(request)
                                )
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
                            client.send(_request.toJson(), wait = transmitDelay)
                            coVerify {
                                app.socketMessageSender.send(
                                    SocketResponse.RegistrationError.of(_request, error)
                                )
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
                            client.send(request.toJson(), wait = transmitDelay)
                        }
                        coVerify(exactly = 2) {
                            app.socketMessageSender.send(
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

            "SEND request" - {
                val messageBody = "hi there"
                val sendRequest = genSendRequest(
                    username = verifiedSenderAccount.username,
                    recipientAddress = recipientAccount.address.asSignalcAddress(),
                    messageBody = messageBody,
                )
                val sendRequestJson = sendRequest.toJson()
                val sendRequestDelay = 30.milliseconds

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns verifiedSenderAccount

                    "sends signal message" {
                        client.send(sendRequest.toJson(), wait=sendRequestDelay)
                        coVerify {
                            app.signalMessageSender.send(
                                verifiedSenderAccount,
                                recipientAccount.address,
                                messageBody,
                                any(),
                                any(),
                            )
                        }
                    }

                    "when sending signal message succeeds" - {
                        coEvery {
                            app.signalMessageSender.send(any(),any(),any(),any(),any())
                        } returns mockk {
                            every { success } returns mockk()
                        }

                        "sends success message to socket" {
                            client.send(sendRequestJson, wait = sendRequestDelay)
                            coVerify {
                                app.socketMessageSender.send(
                                    sendSuccess(sendRequest)
                                )
                            }
                        }
                    }

                    "when sending signal message throws" - {
                        val error = Throwable("arbitrary error!")
                        coEvery {
                            app.signalMessageSender.send(any(),any(),any(),any(),any())
                        } throws error

                        "sends error message to socket" {
                            client.send(sendRequestJson, wait = sendRequestDelay)
                            coVerify {
                                // TODO(aguestuser|2021-02-04): we dont' actually want this.
                                //  we want halting errors to be treated like SendResult statuses below!
                                app.socketMessageSender.send(
                                    requestHandlingError(sendRequest, error)
                                )
                            }
                        }
                    }

                    "when sending signal message returns failure status" - {
                        coEvery {
                            app.signalMessageSender.send(any(),any(),any(),any(),any())
                        } returns mockk {
                            every { success } returns null
                            every { isNetworkFailure } returns true
                        }

                        "sends error message to socket" {
                            client.send(sendRequestJson, wait = 20.milliseconds)
                            coVerify {
                                app.socketMessageSender.send(
                                   SocketResponse.SendResults.networkFailure(sendRequest)
                                )
                            }
                        }
                    }
                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error message to socket" {
                        client.send(sendRequestJson)
                        coVerify {
                            app.socketMessageSender.send(
                                requestHandlingError(
                                    sendRequest,
                                    Error("Can't send to $senderPhoneNumber: not registered.")
                                )
                            )
                        }
                    }
                }
            }

            "SUBSCRIBE request" - {
                val request = genSubscribeRequest(recipientAccount.username)
                val requestJson = request.toJson()
                val sendDelay = 10.milliseconds

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns recipientAccount

                    "when subscription succeeds" - {
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } returns Job()

                        "sends success to socket" {
                            client.send(requestJson, wait = sendDelay)
                            coVerify {
                                app.socketMessageSender.send(
                                    SocketResponse.SubscriptionSuccess(request.id, request.username)
                                )
                            }
                        }
                    }

                    "when message pipe from signal cannot be initiated" - {
                        val error = SignalcError.MessagePipeNotCreated(IOException("whoops!"))
                        val subscribeJob = Job()
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } returns subscribeJob

                        "sends error to socket" {
                            client.send(requestJson)
                            subscribeJob.cancel(error.message!!, error)
                            coVerify {
                                app.socketMessageSender.send(
                                    SocketResponse.SubscriptionFailed(request.id, error)
                                )
                            }
                        }
                    }

                    "when connection to signal is broken" - {
                        val error = IOException("whoops!")
                        val disruptedJob = Job()
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } returnsMany listOf(disruptedJob, Job())

                        "sends error to socket and resubscribes" {
                            client.send(requestJson)
                            disruptedJob.cancel(error.message!!, error)

                            coVerify {
                                app.socketMessageSender.send(
                                    SocketResponse.SubscriptionDisrupted(request.id, error)
                                )
                            }

                            coVerify(atLeast = 2) {
                                app.signalMessageReceiver.subscribe(recipientAccount)
                            }
                        }
                    }
                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error to socket" {
                        client.send(requestJson)
                        delay(10.milliseconds)
                        coVerify {
                            app.socketMessageSender.send(
                                SocketResponse.SubscriptionFailed(
                                    request.id,
                                    SignalcError.SubscriptionOfUnregisteredUser,
                                )
                            )
                        }
                    }
                }
            }

            "VERIFY request" - {
                val request = genVerifyRequest(username = senderPhoneNumber)
                val sendDelay = 10.milliseconds

                "when account is REGISTERED" - { // attempts verification
                    coEvery {
                        app.accountManager.load(senderPhoneNumber)
                    } returns registeredSenderAccount

                    "sanitizes verification code and submits it to signal" {
                        coEvery { app.accountManager.verify(any(), any())} returns mockk()
                        client.send(request.toJson(), wait = sendDelay)
                        coVerify {
                            app.accountManager.verify(
                                registeredSenderAccount,
                                request.code.replace("-", "")
                            )
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
                            client.send(request.toJson(), wait = sendDelay)
                            coVerify {
                                app.accountManager.publishPreKeys(verifiedSenderAccount)
                            }
                        }

                        "sends registration success response to socket" {
                            client.send(request.toJson(), wait = sendDelay)
                            coVerify {
                                app.socketMessageSender.send(
                                    SocketResponse.VerificationSuccess.of(request)
                                )
                            }
                        }
                    }

                    "when verification throws" - {
                        val error = Error("BOOM!")
                        coEvery {
                            app.accountManager.verify(registeredSenderAccount, request.code.asSanitizedCode())
                        } throws error

                        "sends registration error response to socket" {
                            client.send(request.toJson(), wait = sendDelay)
                            coVerify {
                                app.socketMessageSender.send(
                                    SocketResponse.VerificationError.of(request, error)
                                )
                            }
                        }
                    }

                    "when verification submits incorrect code" - {
                        val error = Error("BOOM!")
                        coEvery {
                            app.accountManager.verify(registeredSenderAccount, request.code.asSanitizedCode())
                        } throws error

                        "sends registration error response to socket" {
                            client.send(request.toJson(), wait = sendDelay)
                            coVerify {
                                app.socketMessageSender.send(
                                    SocketResponse.VerificationError.of(request, error)
                                )
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
                        repeat(2) {
                            client.send(request.toJson(), wait = sendDelay)
                        }
                        coVerify(exactly = 2) {
                            app.socketMessageSender.send(
                                SocketResponse.VerificationError.of(
                                    request,
                                    SignalcError.VerificationOfNewOrVerifiedUser
                                )
                            )
                        }
                    }
                }
            }
        }

        "handling terminations" - {
            "when server calls #close"  {
                app.socketMessageReceiver.close(socket.hashCode())
                delay(closeDelay)
                listenJob.invokeOnCompletion {
                    verifyClosed(socket)
                }
            }

            "when client terminates socket connection"  {
                client.close()
                delay(closeDelay)
                listenJob.invokeOnCompletion {
                    verifyClosed(socket)
                }

            }

            "on CLOSE request" - {
                client.send(genCloseRequest().toJson(), wait = closeDelay * 2)
                listenJob.invokeOnCompletion {
                    verifyClosed(socket)
                }
            }
        }
    }
})