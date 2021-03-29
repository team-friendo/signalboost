package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.model.SocketRequest
import info.signalboost.signalc.model.SocketResponse
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genNewAccount
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genRegisteredAccount
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genRegisterRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketRequestGen.genVerifyRequest
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genVerificationError
import info.signalboost.signalc.testSupport.dataGenerators.SocketResponseGen.genVerificationSuccess
import info.signalboost.signalc.testSupport.socket.TestSocketClient
import info.signalboost.signalc.util.StringUtil.asSanitizedCode
import io.kotest.assertions.timing.eventually
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.test.runBlockingTest
import java.net.Socket
import kotlin.io.path.ExperimentalPathApi
import kotlin.io.path.Path
import kotlin.io.path.deleteIfExists
import kotlin.time.ExperimentalTime
import kotlin.time.seconds

@ExperimentalPathApi
@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketServerBigTest : FreeSpec({
    runBlockingTest {
        val testScope = this
        val config = Config.mockAllExcept(
            SocketServer::class,
            SocketSender::class,
            SocketReceiver::class,
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
        val timeout = 1.seconds

        suspend fun getFirstNConnections(numConnections: Int, numAttempts: Int = 0): List<Socket> = try {
            // tries to get a connection 100 times, giving up after 10 times and timeout
            app.socketServer.connections.values.take(numConnections)
        } catch (error: Throwable) {
            if (numAttempts > 100) throw error
            delay(timeout / 100)
            getFirstNConnections(numConnections, numAttempts + 1)
        }

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
            Path(socketPath).deleteIfExists()
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
                getFirstNConnections(2,0)
            }

            afterTest {
                client1.close()
                client2.close()
                receivedMessages.close()
            }

            "accepts connections" {
                eventually(timeout) {
                    app.socketServer.connections.keys.size shouldBe 2
                    app.socketReceiver.readers.size shouldBe 2
                    app.socketSender.writerPool.writers.size shouldBe 2
                }
            }

            "enables sender to write to connections concurrently" {
                val verificationSuccess = genVerificationSuccess()
                val verificationError = genVerificationError()

                testScope.launch {
                    app.socketSender.send(verificationSuccess)
                }
                testScope.launch {
                    app.socketSender.send(verificationError)
                }

                eventually(timeout) {
                    receiveN(2) shouldBe setOf(
                        verificationSuccess.toJson(),
                        verificationError.toJson(),
                    )
                }
            }

            "enables receiver to relay messages to sender" {
                testScope.launch {
                    client1.send("foo")
                }
                testScope.launch {
                    client2.send("bar")
                }

                eventually(timeout) {
                    receiveN(2).forEach {
                        it shouldContain "JsonDecodingException"
                    }
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

                launch {
                    client1.send(helloRequest.toJson())
                }
                launch {
                    client2.send(worldRequest.toJson())
                }

                eventually(timeout) {
                    receiveN(2) shouldBe setOf(
                        SocketResponse.SendResults.success(helloRequest).toJson(),
                        SocketResponse.SendResults.success(worldRequest).toJson(),
                    )
                    coVerify {
                        app.signalSender.send(
                            verifiedSenderAccount,
                            recipientAccount.address,
                            "hello",
                            any(),
                            any(),
                            any()
                        )
                        app.signalSender.send(
                            verifiedSenderAccount,
                            recipientAccount.address,
                            "world",
                            any(),
                            any(),
                            any()
                        )
                    }
                }
            }

            "enables roundtrip handling of a REGISTER request" {
                val request = genRegisterRequest(username = newSenderPhone)

                coEvery {
                    app.accountManager.register(newSenderAccount, request.captcha)
                } returns registeredSenderAccount

                launch { client1.send(request.toJson()) }

                eventually(timeout) {
                    receivedMessages.receive() shouldBe
                            SocketResponse.RegistrationSuccess.of(request).toJson()

                    coVerify {
                        app.accountManager.register(newSenderAccount, request.captcha)
                    }
                }
            }

            "enables roundtrip handling of a VERIFY request" {
                coEvery {
                    app.accountManager.verify(registeredSenderAccount, any())
                } returns verifiedSenderAccount

                val request = genVerifyRequest(username = registeredSenderPhone)
                launch { client1.send(request.toJson()) }

                eventually(timeout) {
                    receivedMessages.receive() shouldBe SocketResponse.VerificationSuccess.of(request).toJson()

                    coVerify {
                        app.accountManager.verify(registeredSenderAccount, request.code.asSanitizedCode())
                    }
                }
            }
        }

        "#disconnect" - {
            lateinit var connections: List<Socket>

            beforeTest {
                client1 = TestSocketClient.connect(socketPath, testScope)
                client2 = TestSocketClient.connect(socketPath, testScope)
                connections = getFirstNConnections(2, 0)

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

            "disconnects a socket connection's message receivers and senders" {
                eventually(timeout) {
                    app.socketReceiver.readers[connections[0].hashCode()] shouldBe null
                    app.socketReceiver.readers[connections[1].hashCode()] shouldBe null
                    app.socketSender.writerPool.writers[connections[0].hashCode()] shouldBe null
                    app.socketSender.writerPool.writers[connections[1].hashCode()] shouldBe null
                }
            }
        }

        "#stop" - {

            beforeTest {
                client1 = TestSocketClient.connect(socketPath, testScope)
                client2 = TestSocketClient.connect(socketPath, testScope)
                getFirstNConnections(2, 0)
                app.socketServer.stop()
            }

            afterTest {
                client1.close()
                client2.close()
            }

            "disconnects receivers and senders from all socket connections" {
                eventually(timeout) {
                    app.socketReceiver.readers.isEmpty() shouldBe true
                    app.socketSender.writerPool.writers.isEmpty() shouldBe true
                }
            }
        }
    }
})