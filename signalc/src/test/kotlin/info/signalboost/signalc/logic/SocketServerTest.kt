package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.socket.TestSocketClient
import io.kotest.assertions.throwables.shouldNotThrow
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.date.after
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runBlockingTest
import java.net.Socket
import java.net.SocketException
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketServerTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(SocketServer::class)
        val app = Application(config).run(testScope)

        val closingDelay = 5.milliseconds
        val socketPath = config.socket.path

        afterTest {
            app.socketServer.closeAllConnections()
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            unmockkAll()
            testScope.teardown()
        }

        fun getFirstConnection() = app.socketServer.connections.values.first()

        "#run" - {
            lateinit var client: TestSocketClient
            lateinit var serverSock: Socket
            beforeTest {
                client = TestSocketClient.connect(socketPath, testScope)
                serverSock = getFirstConnection()
            }
            afterTest {
                client.close()
            }

            "accepts a socket connection and stores a reference to it" {
                app.socketServer.connections.values.size shouldBe 1
            }

            "accepts several concurrent connections" {
                TestSocketClient.connect(socketPath, genTestScope())
                app.socketServer.connections.values.size shouldBe 2
            }

            "attaches a message receiver to a new connection" {
                coVerify {
                    app.socketMessageReceiver.connect(serverSock)
                }
            }
            "attaches a message sender to a new connection" {
                coVerify {
                    app.socketMessageSender.connect(serverSock)
                }
            }

            "when client closes socket connection" - {
                client.close()
                delay(closingDelay)

                "server continues listening for connections" {
                    app.socketServer.listenJob.isCancelled shouldBe false
                }
            }

            "when server closes socket connection" - {
                beforeTest {
                    app.socketServer.socket.close()
                    delay(closingDelay)
                }
                afterTest {
                    app.socketServer.run()
                }

                "stops listening for connections" {
                    app.socketServer.listenJob.isActive shouldBe false
                }

                "refuses new connections" {
                    shouldThrow<SocketException> {
                        TestSocketClient.connect(socketPath, genTestScope())
                    }
                }
            }

            "when server closes socket connection then restarts" - {
                beforeTest {
                    app.socketServer.socket.close()
                    delay(closingDelay)
                    app.socketServer.run()
                }

                "listens for connections" {
                    app.socketServer.listenJob.isActive shouldBe true
                }

                "accepts new connections" {
                    shouldNotThrow<Throwable> {
                        TestSocketClient.connect(socketPath, genTestScope())
                    }
                }

            }

        }

        "#disconnect" - {
            TestSocketClient.connect(socketPath,testScope)
            val socket = getFirstConnection()
            val socketHash = socket.hashCode()

            "disconnects a socket connection's message receiver" {
                app.socketServer.disconnect(socketHash)
                coVerify {
                    app.socketMessageSender.disconnect(socketHash)
                }
            }

            "disconnects a socket connection's message sender" {
                app.socketServer.disconnect(socketHash)
                coVerify {
                    app.socketMessageSender.disconnect(socketHash)
                }
            }

            "closes the socket connection" {
                app.socketServer.disconnect(socketHash)
                socket.isClosed shouldBe true
            }

            "forgets about the socket connection" {
                app.socketServer.disconnect(socketHash)
                app.socketServer.connections[socketHash] shouldBe null
            }
        }

        "#stop" - {
            TestSocketClient.connect(socketPath, testScope)
            val connections = app.socketServer.connections.values

            beforeTest {
                app.socketServer.stop()
            }

            afterTest {
                app.socketServer.run()
            }

            "disconnects receivers from all socket connections" {
                coVerify {
                    app.socketMessageReceiver.stop()
                }

            }
            "disconnects senders from all socket connections" {
                coVerify {
                    app.socketMessageSender.stop()
                }
            }

            "closes all socket connections" {
                connections.forEach {
                    it.isClosed shouldBe true
                }
            }

            "forgets about all socket connections" {
                app.socketServer.connections shouldBe emptyMap()
            }

            "cancels socket listening job" {
                app.socketServer.listenJob.isCancelled shouldBe true
            }
        }
    }
})
