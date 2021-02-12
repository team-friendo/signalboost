package info.signalboost.signalc.testSupport.socket

import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import org.newsclub.net.unix.AFUNIXServerSocket
import org.newsclub.net.unix.AFUNIXSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import java.io.File
import java.io.PrintWriter
import java.net.Socket

@ExperimentalCoroutinesApi
object TestSocketServer {
    suspend fun startTestSocketServer(
        socketPath: String,
        scope: CoroutineScope
    ): ReceiveChannel<Socket> = scope.async {
        // starts a socket server at a path and returns a channel that emits
        // new connections to the server
        val out = Channel<Socket>()
        AFUNIXServerSocket.newInstance().let {
            it.bind(AFUNIXSocketAddress(File(socketPath)))
            scope.launch(IO) {
                while (!out.isClosedForReceive && this.isActive) {
                    val sock = it.accept() as Socket
                    println("Got connection on ${sock.hashCode()}")
                    out.send(sock)
                }
            }
        }
        out
    }.await()

    suspend fun clientConnectsTo(
        socketPath: String,
        connections: ReceiveChannel<Socket>,
        scope: CoroutineScope
    ): Pair<Socket,PrintWriter> = scope.async {
        val clientSock = AFUNIXSocket.newInstance().also {
            it.connect(AFUNIXSocketAddress(File(socketPath)))
        }
        Pair(
            connections.receive(),
            PrintWriter(clientSock.getOutputStream(), true)
        )
    }.await()

}