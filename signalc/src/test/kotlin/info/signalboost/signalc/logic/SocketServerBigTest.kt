package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.SignalMessageSender.Companion.asAddress
import info.signalboost.signalc.model.SendFailure
import info.signalboost.signalc.model.SendSuccess
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.Account.genVerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.PhoneNumber.genPhoneNumber
import info.signalboost.signalc.testSupport.socket.TestSocketClient
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.date.after
import io.kotest.matchers.date.before
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.unmockkAll
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runBlockingTest
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

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
        val sendDelay = 2.milliseconds

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

            val client1 = TestSocketClient.connect(socketPath, testScope)
            val client2 = TestSocketClient.connect(socketPath, testScope)

            "accepts connections" {
                app.socketServer.connections.keys.size shouldBe 2
            }

            "allows receiver to read and relay messages from connections" {
                testScope.launch {
                    client1.send("$recipientPhone,send,hello")
                }
                testScope.launch {
                    client2.send("$recipientPhone,send,world")
                }

                coVerify {
                    app.signalMessageSender.send(
                        senderAccount,
                        recipientPhone.asAddress(),
                        "hello",
                        any(),
                        any(),
                    )
                    app.signalMessageSender.send(
                        senderAccount,
                        recipientPhone.asAddress(),
                        "world",
                        any(),
                        any(),
                    )
                }
            }

            "enables sender to write to connections concurrently" {
                testScope.launch {
                    app.socketMessageSender.send(SendSuccess)
                }
                testScope.launch {
                    app.socketMessageSender.send(SendFailure)
                }
                delay(sendDelay * 2)
                val receivedMessages = (client1.drain() + client2.drain()).toSet()
                receivedMessages shouldBe setOf(SendSuccess.toString(), SendFailure.toString())
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