package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.util.UnixServerSocket
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.date.after
import io.kotest.matchers.shouldBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import kotlinx.coroutines.test.runBlockingTest
import org.newsclub.net.unix.AFUNIXServerSocket
import org.newsclub.net.unix.AFUNIXSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import java.io.File
import java.net.Socket
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketServerTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(SocketServer::class, UnixServerSocket::class)
        val app = Application(config).run(testScope)

        val connectionDelay = 1.milliseconds

        afterTest {
            app.socketServer.closeEach()
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            unmockkAll()
            testScope.teardown()
        }

        suspend fun clientConnectsToSocket(): Socket = async(IO){
            AFUNIXSocket.newInstance().also {
                it.connect(AFUNIXSocketAddress(File(config.socket.path)))
                delay(connectionDelay)
            } as Socket
        }.await()

        fun getFirstConnection() = app.socketServer.socketConnections.values.first()

        "#run" - {
            lateinit var clientSock: Socket
            lateinit var serverSock: Socket
            beforeTest {
                clientSock = clientConnectsToSocket()
                serverSock = getFirstConnection()
            }

            "accepts a socket connection and stores a reference to it" {
                app.socketServer.socketConnections.values.size shouldBe 1
            }

            "accepts several concurrent connections" {
                clientConnectsToSocket()
                app.socketServer.socketConnections.values.size shouldBe 2
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
                clientSock.close()
                delay(10.milliseconds)
                "server continues listening for connections" {
                    app.socketServer.listenJob.isCancelled shouldBe false
                }
            }
        }

        "#disconnect" - {
            clientConnectsToSocket()
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
                app.socketServer.socketConnections[socketHash] shouldBe null
            }
        }

        "#stop" - {

            clientConnectsToSocket()
            val connections = app.socketServer.socketConnections.values

            "disconnects receivers from all socket connections" {
                app.socketServer.stop()
                coVerify {
                    app.socketMessageReceiver.stop()
                }

            }
            "disconnects senders from all socket connections" {
                app.socketServer.stop()
                coVerify {
                    app.socketMessageSender.stop()
                }
            }

            "closes all socket connections" {
                app.socketServer.stop()
                connections.forEach {
                    it.isClosed shouldBe true
                }
            }

            "forgets about all socket connections" {
                app.socketServer.stop()
                app.socketServer.socketConnections shouldBe emptyMap()
            }

            "cancels socket listening job" {
                app.socketServer.stop()
                app.socketServer.listenJob.isCancelled shouldBe true
            }
        }

        "when server socket is closed" - {
            // NOTE: it is hard to restore testable state after this test so keep it last in the file!
            clientConnectsToSocket()
            app.socket.close()
            delay(10.milliseconds)

            "stops listening for connections" {
                app.socketServer.listenJob.isCancelled shouldBe true
            }
        }
    }
})
