package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.error.SignalcError
import info.signalboost.signalc.model.*
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genNewAccount
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genRegisteredAccount
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genAbortRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genCloseRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genRegisterRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSubscribeRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genVerifyRequest
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genSocketPath
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.registrationError
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.requestHandlingError
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.sendSuccess
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.subscriptionDisrupted
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.subscriptionFailed
import info.signalboost.signalc.testSupport.matchers.SocketResponseMatchers.subscriptionSuccess
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
        val recipientAccount = genVerifiedAccount()

        val now = Instant.now().toEpochMilli()
        val connectDelay = 20.milliseconds
        val closeDelay = 20.milliseconds

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
            delay(connectDelay)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            client.close()
            socketServer.close()
            testScope.teardown()
            serverScope.teardown()
            unmockkAll()
        }

        fun verifyClosed(socket: Socket) {
            app.socketReceiver.readers[socket.hashCode()] shouldBe null
            coVerify {
                app.socketServer.close(socket.hashCode())
            }
        }

        "handling connections" - {
            afterTest{
                client.close()
            }

            "opens a reader on a socket and stores a reference to it" {
                app.socketReceiver.readers[socket.hashCode()] shouldNotBe null
                app.socketReceiver.close(socket.hashCode())
            }
        }

        "handling command messages" - {
            afterTest{
                client.close()
            }

            "ABORT request" - {
                val request = genAbortRequest()
                val transmitDelay = 30.milliseconds

                "shuts down the app" {
                    client.send(request.toJson(), wait = transmitDelay)
                    coVerify {
                        app.socketSender.send(any<SocketResponse.AbortWarning>())
                        app.socketServer.stop()
                    }
                }
            }


            "REGISTER request" - {
                val request = genRegisterRequest(username = senderPhoneNumber)
                val transmitDelay = 20.milliseconds

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
                                app.socketSender.send(
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
                                app.socketSender.send(
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
                            app.signalSender.send(
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
                            app.signalSender.send(any(),any(),any(),any(),any())
                        } returns mockk {
                            every { success } returns mockk()
                        }

                        "sends success message to socket" {
                            client.send(sendRequestJson, wait = sendRequestDelay)
                            coVerify {
                                app.socketSender.send(
                                    sendSuccess(sendRequest)
                                )
                            }
                        }
                    }

                    "when sending signal message throws" - {
                        val error = Throwable("arbitrary error!")
                        coEvery {
                            app.signalSender.send(any(),any(),any(),any(),any())
                        } throws error

                        "sends error message to socket" {
                            client.send(sendRequestJson, wait = sendRequestDelay)
                            coVerify {
                                // TODO(aguestuser|2021-02-04): we dont' actually want this.
                                //  we want halting errors to be treated like SendResult statuses below!
                                app.socketSender.send(
                                    requestHandlingError(sendRequest, error)
                                )
                            }
                        }
                    }

                    "when sending signal message returns failure status" - {
                        coEvery {
                            app.signalSender.send(any(),any(),any(),any(),any())
                        } returns mockk {
                            every { success } returns null
                            every { isNetworkFailure } returns true
                        }

                        "sends error message to socket" {
                            client.send(sendRequestJson, wait = 20.milliseconds)
                            coVerify {
                                app.socketSender.send(
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

            "SUBSCRIBE request" - {
                val request = genSubscribeRequest(recipientAccount.username)
                val requestJson = request.toJson()
                val sendDelay = 10.milliseconds

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns recipientAccount

                    "when subscription succeeds" - {
                        coEvery {
                            app.signalReceiver.subscribe(recipientAccount)
                        } returns Job()

                        "sends success to socket" {
                            client.send(requestJson, wait = sendDelay)
                            coVerify {
                                app.socketSender.send(
                                    subscriptionSuccess(request.id, request.username)
                                )
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
                            coVerify {
                                app.socketSender.send(
                                    subscriptionFailed(request.id, error)
                                )
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
                            delay(5.milliseconds)

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

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error to socket" {
                        client.send(requestJson)
                        delay(10.milliseconds)
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
                                app.socketSender.send(
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
                                app.socketSender.send(
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
                                app.socketSender.send(
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
                            app.socketSender.send(
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

        "handling connection terminations" - {
            "when server calls #close"  {
                app.socketReceiver.close(socket.hashCode())
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