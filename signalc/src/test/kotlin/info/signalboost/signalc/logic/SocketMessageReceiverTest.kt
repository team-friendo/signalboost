package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.SignalMessageSender.Companion.asAddress
import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.Account.genNewAccount
import info.signalboost.signalc.testSupport.fixtures.Account.genVerifiedAccount
import info.signalboost.signalc.testSupport.matchers.SocketOutMessageMatchers.commandExecutionError
import info.signalboost.signalc.util.TimeUtil
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runBlockingTest
import java.io.BufferedReader
import java.io.IOException
import java.net.Socket
import java.time.Instant
import kotlin.time.*


@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketMessageReceiverTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(SocketMessageReceiver::class)
        val app = Application(config).run(testScope)
        val messageReceiver = app.signalMessageReceiver

        // TODO: use genPhoneNumber() here once we have un-hardcoded sender
        val senderPhoneNumber = Config.USER_PHONE_NUMBER
        val newAccount = genNewAccount()
        val senderAccount = genVerifiedAccount(senderPhoneNumber)
        val recipientAccount = genVerifiedAccount()
        val now = Instant.now().toEpochMilli()
        val loopDelay = 20.milliseconds

        beforeSpec {
            mockkObject(SocketMessageReceiver.Reader)
            mockkObject(TimeUtil).also {
                every { TimeUtil.nowInMillis() } returns now
            }
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            unmockkAll()
            testScope.teardown()
        }

        fun socketEmits(messages: List<String?>): Pair<Socket,BufferedReader> {
            val mockkSocket = mockk<Socket>()
            val mockkReader = mockk<BufferedReader> {
                every { readLine() } returnsMany messages
                every { close() } returns Unit
            }

            every {
                SocketMessageReceiver.Reader.of(any())
            } returns mockkReader

            return(mockkSocket to mockkReader)
        }

        suspend fun receiveMessageOn(socket: Socket): Unit =
            app.socketMessageReceiver.connect(socket).let {
                delay(loopDelay)
                it.cancel()
            }


        "#connect" - {
            // TODO: flakey tests!
            // (pass in isolation but not together! boo!!!)
            val (socket, reader) = socketEmits(listOf(""))

            "opens a reader on a socket and stores a reference to it" {
                receiveMessageOn(socket)
                app.socketMessageReceiver.readers[socket.hashCode()] shouldBe reader
                verify { reader.readLine() }
            }

            "when client terminates socket connection" - {
                // note: connection closure is signaled by `readLine()` returning `null`
                "closes server side of socket connection" {}
            }

            "when socket emits ABORT command" - {
                "notifies all sockets of shutdown" {}
                "shuts down the app" {}
            }

            "when socket emits CLOSE command" - {
                "closes socket connection to client" {}
            }

            "when socket emits SEND command" - {
                val msg = "hi there"
                val (socket)  = socketEmits(listOf("${recipientAccount.username},send,$msg"))

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns senderAccount

                    "sends signal message" {
                        receiveMessageOn(socket)
                        coVerify {
                            app.signalMessageSender.send(
                                senderAccount,
                                recipientAccount.username.asAddress(),
                                msg,
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
                            receiveMessageOn(socket)

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
                            receiveMessageOn(socket)
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
                            receiveMessageOn(socket)
                            coVerify {
                                app.socketMessageSender.send(SendFailure)
                            }
                        }
                    }
                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error message to socket" {
                        app.socketMessageReceiver.connect(socket).cancel()
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

            "when socket emits SUBSCRIBE command" {
                val (socket)  = socketEmits(listOf("${recipientAccount.username},subscribe,"))

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns recipientAccount

                    "subscribes to messages for account" {
                        receiveMessageOn(socket)
                        coVerify {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        }
                    }

                    "when subscription succeeds" - {
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } returns mockk()

                        "sends success to socket" {
                            receiveMessageOn(socket)
                            coVerify {
                                app.socketMessageSender.send(SubscribeSuccess)
                            }
                        }
                    }

                    "when subscription fails (eg: due to failed WS connection)" - {
                        val error = IOException("whoops!")
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } throws error

                        "sends error to socket" {
                            receiveMessageOn(socket)
                            coVerify {
                                app.socketMessageSender.send(SubscribeFailure(error))
                            }
                        }
                        // TODO: testing this is hard!
                        "resubscribes" {}
                    }

                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error to socket" {
                        receiveMessageOn(socket)
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

        "#disconnect" - {
            "closes connection on socket" - {}
            "removes sockets from internal state" - {}
        }
    }
})