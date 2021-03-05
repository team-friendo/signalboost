package info.signalboost.signalc.testSupport.socket

import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import mu.KLoggable
import org.newsclub.net.unix.AFUNIXServerSocket
import org.newsclub.net.unix.AFUNIXSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import java.io.File
import java.io.PrintWriter
import java.net.Socket

@ExperimentalCoroutinesApi
class TestSocketServer(
    private val connections: ReceiveChannel<Socket>,
    private val listenJob: Job,
) {
    companion object: Any(), KLoggable {
        override val logger = logger()

        suspend fun run(socketPath: String, scope: CoroutineScope): TestSocketServer = scope.async {
            // - starts a socket server at a path
            // - returns a TestSocketServer instance wrapping a `connections` channel
            //   that recieves new connections for use in test suite
            val out = Channel<Socket>()
            lateinit var listenJob: Job
            AFUNIXServerSocket.newInstance().let {
                it.bind(AFUNIXSocketAddress(File(socketPath)))
                logger.debug("Test server listening for connections on $socketPath...")

                listenJob = scope.launch(IO) {
                    while (!out.isClosedForReceive && this.isActive) {
                        val sock = it.accept() as Socket
                        logger.debug("Got connection on ${sock.hashCode()}")
                        out.send(sock)
                    }
                }
            }
            TestSocketServer(out, listenJob)
        }.await()
    }

    suspend fun receive(): Socket = connections.receive()

    fun close()  {
        connections.cancel()
        listenJob.cancel()
    }

}