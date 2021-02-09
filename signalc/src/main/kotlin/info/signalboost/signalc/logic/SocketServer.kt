package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.util.SocketHashCode
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketServer(val app: Application): Application.ReturningRunnable<SocketServer> {

    internal lateinit var listenJob: Job
    internal val socketConnections = ConcurrentHashMap<SocketHashCode,Socket>()

    override suspend fun run(): SocketServer {
        listenJob = app.coroutineScope.launch(IO) {
            app.socket.use {
                while (!it.isClosed && this.isActive) {
                    val sock = try {
                        it.accept() as Socket
                    } catch (e: Throwable) {
                        println("Socket server closed.")
                        return@launch
                    }
                    val socketHash = sock.hashCode()
                    println("Got connection on socket ${socketHash}!")
                    socketConnections[socketHash] = sock
                    launch {
                        app.socketMessageReceiver.connect(sock)
                        app.socketMessageSender.connect(sock)
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
        println("Server closed connection on socket $socketHash")
    }

    suspend fun stop(): Unit = app.coroutineScope.async(IO) {
        listenJob.cancel()
        app.socketMessageReceiver.stop()
        app.socketMessageSender.stop()
        socketConnections.keys.map { close(it) }
        Unit
    }.await()

    private suspend fun close(socketHash: SocketHashCode) = app.coroutineScope.async(IO) {
        socketConnections[socketHash]?.close()
        socketConnections.remove(socketHash)
    }.await()
}