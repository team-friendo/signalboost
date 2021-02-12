package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.SignalMessageSender.Companion.asAddress
import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.Account.genVerifiedAccount
import info.signalboost.signalc.testSupport.matchers.SocketOutMessageMatchers.commandExecutionError
import info.signalboost.signalc.testSupport.socket.TestSocketClient
import info.signalboost.signalc.testSupport.socket.TestSocketServer.clientConnectsTo
import info.signalboost.signalc.testSupport.socket.TestSocketServer.startTestSocketServer
import info.signalboost.signalc.util.*
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.test.runBlockingTest
import java.io.IOException
import java.io.PrintWriter
import java.net.Socket
import java.time.Instant
import kotlin.random.Random
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds
import kotlin.time.times


@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketMessageReceiverTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(SocketMessageReceiver::class)
        val app = Application(config).run(testScope)

        // TODO: use genPhoneNumber() here once we have un-hardcoded sender
        val senderPhoneNumber = Config.USER_PHONE_NUMBER
        val senderAccount = genVerifiedAccount(senderPhoneNumber)
        val recipientAccount = genVerifiedAccount()

        val now = Instant.now().toEpochMilli()
        val connectDelay = 1.milliseconds
        val closeDelay = 1.milliseconds

        val socketPath = app.config.socket.path + Random.nextInt(Int.MAX_VALUE).toString()
        val socketConnections: ReceiveChannel<Socket> = startTestSocketServer(socketPath, testScope)

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
            socket = socketConnections.receive()
            listenJob = app.socketMessageReceiver.connect(socket)
            delay(connectDelay)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            socketConnections.cancel()
            unmockkAll()
            testScope.teardown()
        }

        fun verifyClosed(socket: Socket) {
            app.socketMessageReceiver.readers[socket.hashCode()] shouldBe null
            coVerify {
                app.socketServer.disconnect(socket.hashCode())
            }
        }

        "handling connections" - {
            afterTest{
                client.close()
            }

            "opens a reader on a socket and stores a reference to it" {
                app.socketMessageReceiver.readers[socket.hashCode()] shouldNotBe null
                app.socketMessageReceiver.disconnect(socket.hashCode())
            }
        }

        "handling messages" - {
            afterTest{
                client.close()
            }

            "when client sends SEND command" - {
                val messageBody = "hi there"
                val sendCommand = "${recipientAccount.username},send,$messageBody"

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns senderAccount

                    "sends signal message" {
                        client.send(sendCommand)
                        coVerify {
                            app.signalMessageSender.send(
                                senderAccount,
                                recipientAccount.username.asAddress(),
                                messageBody,
                                any(),
                                any(),
                            )
                        }
                    }

                    "when sending signal message succeeds" - {
                        coEvery {
                            app.signalMessageSender.send(any(),any(),any(),any(),any())
                        } returns mockk(){
                            every { success } returns mockk()
                        }

                        "sends success message to socket" {
                            client.send(sendCommand, wait = 5.milliseconds)
                            coVerify {
                                app.socketMessageSender.send(SendSuccess)
                            }
                        }
                    }

                    "when sending signal message throws" - {
                        val error = Throwable("arbitrary error!")
                        coEvery {
                            app.signalMessageSender.send(any(),any(),any(),any(),any())
                        } throws error

                        "sends error message to socket" {
                            client.send(sendCommand, wait = 5.milliseconds)
                            coVerify {
                                // TODO(aguestuser|2021-02-04): we dont' actually want this.
                                //  we want halting errors to be treated like SendResult statuses below!
                                app.socketMessageSender.send(
                                    CommandExecutionError("send", error)
                                )
                            }
                        }
                    }

                    "when sending signal message returns failure status" - {
                        coEvery {
                            app.signalMessageSender.send(any(),any(),any(),any(),any())
                        } returns mockk {
                            every { success } returns null
                        }

                        "sends error message to socket" {
                            client.send(sendCommand, wait = 5.milliseconds)
                            coVerify {
                                app.socketMessageSender.send(SendFailure)
                            }
                        }
                    }
                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error message to socket" {
                        client.send(sendCommand)
                        coVerify {
                            app.socketMessageSender.send(
                                commandExecutionError(
                                    "send",
                                    Error("Can't send to $senderPhoneNumber: not registered.")
                                )
                            )
                        }
                    }
                }
            }

            "when client sends SUBSCRIBE command" - {
                val subscribeCommand = "${recipientAccount.username},subscribe,"

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns recipientAccount

                    "when subscription succeeds" - {
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } returns Job()

                        "sends success to socket" {
                            client.send(subscribeCommand)
                            coVerify {
                                app.socketMessageSender.send(SubscriptionSucceeded)
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
                            client.send(subscribeCommand)
                            subscribeJob.cancel(error.message!!, error)
                            coVerify {
                                app.socketMessageSender.send(SubscriptionFailed(error))
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
                            client.send(subscribeCommand)
                            disruptedJob.cancel(error.message!!, error)

                            coVerify {
                                app.socketMessageSender.send(SubscriptionDisrupted(error))

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
                        client.send(subscribeCommand)
                        coVerify {
                            app.socketMessageSender.send(
                                commandExecutionError(
                                    "subscribe",
                                    Error("Can't subscribe to messages for ${recipientAccount.username}: not registered."))
                            )
                        }
                    }
                }
            }
        }

        "handling terminations" -{
            "when server calls #disconnect" - {
                "closes socket connection" {
                    app.socketMessageReceiver.disconnect(socket.hashCode())
                    delay(closeDelay)

                    listenJob.invokeOnCompletion {
                        verifyClosed(socket)
                    }
                }
            }

            "when client terminates socket connection" - {
                client.close()
                delay(closeDelay)

                "closes server side of socket connection" {
                    listenJob.invokeOnCompletion {
                        verifyClosed(socket)
                    }
                }
            }

            "when client sends CLOSE command" - {
                "closes socket connection to client" {
                    client.send(",close,")
                    delay(closeDelay)

                    listenJob.invokeOnCompletion {
                        verifyClosed(socket)
                    }
                }
            }

            "when client sends ABORT command" - {
                "shuts down the app" {
                    client.send(",abort,")
                    coVerify {
                        app.socketMessageSender.send(any<Shutdown>())
                        app.socketServer.stop()
                    }
                }
            }
        }
    }

})