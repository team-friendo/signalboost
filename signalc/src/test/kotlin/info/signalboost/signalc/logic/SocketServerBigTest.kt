package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.model.SocketRequest
import info.signalboost.signalc.model.SocketResponse
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.AccountGen.genNewAccount
import info.signalboost.signalc.testSupport.fixtures.AccountGen.genRegisteredAccount
import info.signalboost.signalc.testSupport.fixtures.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genRegisterRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genVerifyRequest
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genVerificationError
import info.signalboost.signalc.testSupport.fixtures.SocketResponseGen.genVerificationSuccess
import info.signalboost.signalc.testSupport.socket.TestSocketClient
import info.signalboost.signalc.util.StringUtil.asSanitizedCode
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.test.runBlockingTest
import java.net.Socket
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@InternalCoroutinesApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketServerBigTest : FreeSpec({
    runBlockingTest {
        val testScope = this
        val config = Config.mockAllExcept(
            SocketServer::class,
            SocketMessageSender::class,
            SocketMessageReceiver::class,
        )
        val app = Application(config).run(testScope)

        val newSenderPhone = genPhoneNumber()
        val newSenderAccount = genNewAccount(newSenderPhone)
        val registeredSenderPhone = genPhoneNumber()
        val registeredSenderAccount = genRegisteredAccount(registeredSenderPhone)
        val verifiedSenderPhone = genPhoneNumber()
        val verifiedSenderAccount = genVerifiedAccount(verifiedSenderPhone)
        val recipientPhone = genPhoneNumber()
        val recipientAccount = genVerifiedAccount(recipientPhone)

        val socketPath = app.config.socket.path

        beforeSpec {
            coEvery {
                app.accountManager.loadVerified(any())
            } answers {
                when(firstArg<String>()) {
                    verifiedSenderPhone -> verifiedSenderAccount
                    recipientPhone -> recipientAccount
                    else -> null
                }
            }
            coEvery {
                app.accountManager.load(any())
            } answers {
                when(firstArg<String>()) {
                    newSenderPhone -> newSenderAccount
                    registeredSenderPhone -> registeredSenderAccount
                    verifiedSenderPhone -> verifiedSenderAccount
                    else -> newSenderAccount
                }
            }

        }

        afterSpec {
            app.stop()
            unmockkAll()
            testScope.teardown()
        }

        lateinit var client1: TestSocketClient
        lateinit var client2: TestSocketClient

        "#run" - {
            lateinit var receivedMessages: Channel<String>
            suspend fun receiveN(n: Int) = List(n) { receivedMessages.receive() }.toSet()

            beforeTest {
                receivedMessages = Channel<String>()
                client1 = TestSocketClient.connect(socketPath, testScope, receivedMessages)
                client2 = TestSocketClient.connect(socketPath, testScope, receivedMessages)
                delay(20.milliseconds)
            }

            afterTest {
                client1.close()
                client2.close()
                receivedMessages.close()
            }

            "accepts connections" {
                app.socketServer.connections.keys.size shouldBe 2
                app.socketMessageReceiver.readers.size shouldBe 2
                app.socketMessageSender.writerPool.writers.size shouldBe 2
            }

            "enables sender to write to connections concurrently" {
                val verificationSuccess = genVerificationSuccess()
                val verificationError = genVerificationError()

                testScope.launch {
                    app.socketMessageSender.send(verificationSuccess)
                }
                testScope.launch {
                    app.socketMessageSender.send(verificationError)
                }
                receiveN(2) shouldBe setOf(
                    verificationSuccess.toJson(),
                    verificationError.toJson(),
                )
            }

            "enables receiver to relay messages to sender" {
                testScope.launch {
                    client1.send("foo")
                }
                testScope.launch {
                    client2.send("bar")
                }

                receiveN(2).forEach {
                    it shouldContain "JsonDecodingException"
                }
            }


            "enables roundtrip handling of concurrent SEND requests" {

                fun sendRequestOf(msg: String): SocketRequest.Send = genSendRequest(
                    id = genUuidStr(),
                    username = verifiedSenderAccount.username,
                    recipientAddress = recipientAccount.address.asSignalcAddress(),
                    messageBody = msg,
                )

                val helloRequest = sendRequestOf("hello")
                val worldRequest = sendRequestOf("world")

                coEvery {
                    app.signalMessageSender.send(any(),any(),any(),any(),any())
                } returns mockk(){
                    every { success } returns mockk()
                }

                launch {
                    client1.send(helloRequest.toJson())
                }
                launch {
                    client2.send(worldRequest.toJson())
                }

                receiveN(2) shouldBe setOf(
                    SocketResponse.SendResults.success(helloRequest).toJson(),
                    SocketResponse.SendResults.success(worldRequest).toJson(),
                )

                coVerify {
                    app.signalMessageSender.send(verifiedSenderAccount, recipientAccount.address, "hello", any(), any())
                    app.signalMessageSender.send(verifiedSenderAccount, recipientAccount.address, "world", any(), any())
                }
            }

            "enables roundtrip handling of a REGISTER request" {
                val request = genRegisterRequest(username = newSenderPhone)

                coEvery {
                    app.accountManager.register(newSenderAccount, request.captcha)
                } returns registeredSenderAccount

                launch { client1.send(request.toJson()) }

                receivedMessages.receive() shouldBe
                        SocketResponse.RegistrationSuccess.of(request).toJson()
                coVerify {
                    app.accountManager.register(newSenderAccount, request.captcha)
                }
            }

            "enables roundtrip handling of a VERIFY request" {
                coEvery {
                    app.accountManager.verify(registeredSenderAccount, any())
                } returns verifiedSenderAccount

                val request = genVerifyRequest(username = registeredSenderPhone)
                launch { client1.send(request.toJson()) }

                receivedMessages.receive() shouldBe SocketResponse.VerificationSuccess.of(request).toJson()
                coVerify {
                    app.accountManager.verify(registeredSenderAccount, request.code.asSanitizedCode())
                }
            }

        }

        "#disconnect" - {

            lateinit var connections: List<Socket>

            beforeTest {
                client1 = TestSocketClient.connect(socketPath, testScope)
                client2 = TestSocketClient.connect(socketPath, testScope)

                delay(10.milliseconds)
                connections = app.socketServer.connections.values.take(2)

                testScope.launch {
                    app.socketServer.close(connections[0].hashCode())
                }
                testScope.launch {
                    app.socketServer.close(connections[1].hashCode())
                }

            }

            afterTest {
                client1.close()
                client2.close()
            }

            "disconnects a socket connection's message receiver" {
                app.socketMessageReceiver.readers[connections[0].hashCode()] shouldBe null
                app.socketMessageReceiver.readers[connections[1].hashCode()] shouldBe null
            }

            "disconnects a socket connection's message sender" {
                app.socketMessageSender.writerPool.writers[connections[0].hashCode()] shouldBe null
                app.socketMessageSender.writerPool.writers[connections[1].hashCode()] shouldBe null
            }
        }

        "#stop" - {
            val restartDelay =20.milliseconds

            beforeTest {
                client1 = TestSocketClient.connect(socketPath, testScope)
                client2 = TestSocketClient.connect(socketPath, testScope)
                app.socketServer.stop()
                delay(restartDelay)
            }

            afterTest {
                client1.close()
                client2.close()
            }

            afterTest {
                app.socketServer.run()
                delay(restartDelay)
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