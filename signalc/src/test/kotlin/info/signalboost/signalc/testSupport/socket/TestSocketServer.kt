package info.signalboost.signalc.testSupport.socket

import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.Default
import kotlinx.coroutines.Dispatchers.IO
import kotlinx.coroutines.Dispatchers.Unconfined
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import mu.KLoggable
import okhttp3.internal.closeQuietly
import org.newsclub.net.unix.AFUNIXServerSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import java.io.File
import java.net.Socket
import java.util.concurrent.Executors

@ExperimentalCoroutinesApi
class TestSocketServer(
    private val socket: AFUNIXServerSocket,
    private val connections: ReceiveChannel<Socket>,
    private val listenJob: Job,
) {
    companion object: Any(), KLoggable {
        override val logger = logger()
        private val dispatcher = Executors.newCachedThreadPool().asCoroutineDispatcher()

        suspend fun run(socketPath: String, scope: CoroutineScope): TestSocketServer = withContext(Unconfined) {
            // - starts a socket server at a path
            // - returns a TestSocketServer instance wrapping a `connections` channel
            //   that recieves new connections for use in test suite
            val connections = Channel<Socket>()
            lateinit var listenJob: Job
            val serverSock = AFUNIXServerSocket.newInstance().also {
                it.bind(AFUNIXSocketAddress(File(socketPath)))
                logger.debug("Test server listening for connections on $socketPath...")

                listenJob = scope.launch(dispatcher) {
                    while (!it.isClosed && !connections.isClosedForReceive && this.isActive) {
                        val connection = try {
                            it.accept() as Socket
                        } catch (e: Throwable) {
                            logger.error { e.stackTraceToString() }
                            return@launch
                        }
                        logger.debug("...Got connection on ${connection.hashCode()}")
                        connections.send(connection)
                    }
                }
            }
            TestSocketServer(serverSock, connections, listenJob)
        }
    }

    suspend fun receive(): Socket = connections.receive()

    fun close()  {
        socket.close()
        listenJob.cancel()
        connections.cancel()
    }
}