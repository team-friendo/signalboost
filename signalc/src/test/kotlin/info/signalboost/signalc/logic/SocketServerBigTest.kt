package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.SignalMessageSender.Companion.asAddress
import info.signalboost.signalc.model.CommandInvalid
import info.signalboost.signalc.model.SendFailure
import info.signalboost.signalc.model.SendSuccess
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.Account.genVerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.Address.genPhoneNumber
import info.signalboost.signalc.testSupport.socket.TestSocketClient
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.InternalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runBlockingTest
import kotlin.time.ExperimentalTime

@InternalCoroutinesApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketServerBigTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(
            SocketServer::class,
            SocketMessageSender::class,
            SocketMessageReceiver::class,
        )
        val app = Application(config).run(testScope)

        // TODO: unhardcode this!
        val senderPhone = Config.USER_PHONE_NUMBER
        val senderAccount = genVerifiedAccount(senderPhone)
        val recipientPhone = genPhoneNumber()
        val recipientAccount = genVerifiedAccount(recipientPhone)

        val socketPath = app.config.socket.path

        beforeSpec {
            coEvery {
                app.accountManager.loadVerified(any())
            } answers {
                when(firstArg<String>()) {
                    senderPhone -> senderAccount
                    recipientPhone -> recipientAccount
                    else -> null
                }
            }
        }

        afterSpec {
            app.stop()
            unmockkAll()
            testScope.teardown()
        }


        "#run" - {
            val receivedMessages = Channel<String>()

            val client1 = TestSocketClient.connect(socketPath, testScope, receivedMessages)
            val client2 = TestSocketClient.connect(socketPath, testScope, receivedMessages)

            suspend fun receiveN(n: Int) = List(n) {
                receivedMessages.receive()
            }.toSet()


            "accepts connections" {
                app.socketServer.connections.keys.size shouldBe 2
                app.socketMessageReceiver.readers.size shouldBe 2
                app.socketMessageSender.writerPool.writers.size shouldBe 2
            }

            "enables sender to write to connections concurrently" {
                launch {
                    app.socketMessageSender.send(SendSuccess)
                }
                launch {
                    app.socketMessageSender.send(SendFailure)
                }
                receiveN(2) shouldBe setOf(SendSuccess.toString(), SendFailure.toString())
            }

            "handles roundtrip from socket receiver to socket writer" {
                launch {
                    client1.send("foo")
                }
                launch {
                    client2.send("bar")
                }

                receiveN(2) shouldBe setOf(
                    CommandInvalid("foo", "foo").toString(),
                    CommandInvalid("bar", "bar").toString()
                )
            }


            "handles roundtrip from socket receiver to signal sender to socket writer" - {
                fun sendCommandOf(msg: String): String = "$recipientPhone,send,$msg"

                coEvery {
                    app.signalMessageSender.send(any(),any(),any(),any(),any())
                } returns mockk(){
                    every { success } returns mockk()
                }

                launch {
                    client1.send(sendCommandOf("hello"))
                }
                launch {
                    client2.send(sendCommandOf("world"))
                }

                receiveN(2) shouldBe setOf(
                    SendSuccess.toString(),
                    SendSuccess.toString(),
                )

                coVerify {
                    app.signalMessageSender.send(senderAccount, recipientPhone.asAddress(), "hello", any(), any())
                    app.signalMessageSender.send(senderAccount, recipientPhone.asAddress(), "world", any(), any())
                }
            }
        }

        "#disconnect" - {

            app.socketServer.closeAllConnections()
            TestSocketClient.connect(socketPath, testScope)
            TestSocketClient.connect(socketPath, testScope)
            val (connection1, connection2) = app.socketServer.connections.values.take(2)

            testScope.launch {
                app.socketServer.disconnect(connection1.hashCode())
            }
            testScope.launch {
                app.socketServer.disconnect(connection2.hashCode())
            }

            "disconnects a socket connection's message receiver" {
                app.socketMessageReceiver.readers[connection1.hashCode()] shouldBe null
                app.socketMessageReceiver.readers[connection2.hashCode()] shouldBe null
            }

            "disconnects a socket connection's message sender" {
                app.socketMessageSender.writerPool.writers[connection1.hashCode()] shouldBe null
                app.socketMessageSender.writerPool.writers[connection2.hashCode()] shouldBe null
            }
        }

        "#stop" - {
            beforeTest {
                TestSocketClient.connect(socketPath, testScope)
                TestSocketClient.connect(socketPath, testScope)
                app.socketServer.stop()
            }

            afterTest {
                app.socketServer.run()
            }

            "disconnects receivers from all socket connections" {
                app.socketMessageReceiver.readers.isEmpty() shouldBe true
            }

            "disconnects senders from all socket connections" {
                app.socketMessageSender.writerPool.writers.isEmpty() shouldBe true
            }
        }
    }
})