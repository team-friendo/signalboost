package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.util.SocketHashCode
import kotlinx.coroutines.*
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap

@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketServer(val app: Application): Application.ReturningRunnable<SocketServer> {

    private val socketConnections = ConcurrentHashMap<SocketHashCode,Socket>()

    override suspend fun run(): SocketServer {
        app.coroutineScope.launch {
            app.socket.use {
                while (true) {
                    withContext(Dispatchers.IO) {
                        val sock = it.accept() as Socket
                        val socketHash = sock.hashCode()
                        println("got connection on socket ${socketHash}!")
                        socketConnections[socketHash] = sock
                        launch {
                            app.socketMessageReceiver.connect(sock)
                            app.socketMessageSender.connect(sock)
                        }
                    }
                }
            }
        }
        return this
    }

    suspend fun disconnect(socketHash: SocketHashCode): Unit = withContext(Dispatchers.IO) {
        app.socketMessageSender.disconnect(socketHash)
        app.socketMessageReceiver.disconnect(socketHash)
        close(socketHash)
        println("closed connection on socket $socketHash")
    }

    suspend fun stop() = withContext(Dispatchers.IO) {
        app.socketMessageReceiver.stop()
        app.socketMessageSender.stop()
        socketConnections.keys.forEach { close(it) }
        app.socket.close()
    }

    private suspend fun close(socketHash: SocketHashCode) {
        withContext(Dispatchers.IO) {
            socketConnections[socketHash]?.close()
        }
        socketConnections.remove(socketHash)
    }
}