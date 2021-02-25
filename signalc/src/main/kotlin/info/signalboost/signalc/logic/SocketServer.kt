package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.util.SocketHashCode
import info.signalboost.signalc.util.UnixServerSocket
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import org.newsclub.net.unix.AFUNIXServerSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import java.io.File
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketServer(val app: Application): Application.ReturningRunnable<SocketServer> {

    internal lateinit var socket: UnixServerSocket
    internal lateinit var listenJob: Job
    internal val connections = ConcurrentHashMap<SocketHashCode,Socket>()

    override suspend fun run(): SocketServer {

        socket = app.coroutineScope.async {
            AFUNIXServerSocket.newInstance().apply {
                bind(AFUNIXSocketAddress(File(app.config.socket.path)))
            }
        }.await()

        listenJob = app.coroutineScope.launch(IO) {
            while (this.isActive && !socket.isClosed) {
                println("Socker server listening...")
                val connection = try {
                    socket.accept() as Socket
                } catch (e: Throwable) {
                    println("Server socket closed.")
                    return@launch stop()
                }
                val socketHash = connection.hashCode().also { connections[it] = connection }
                println("Got connection on socket $socketHash")
                launch(IO) {
                    app.socketMessageReceiver.connect(connection)
                    println("Connected reader to socket $socketHash")
                    app.socketMessageSender.connect(connection)
                    println("Connected writer to socket $socketHash")
                }
            }
        }

        return this
    }

    suspend fun close(socketHash: SocketHashCode): Unit = withContext(Dispatchers.IO) {
        app.socketMessageSender.close(socketHash)
        app.socketMessageReceiver.close(socketHash)
        closeConnection(socketHash)
        println("Server closed connection on socket $socketHash")
    }

    suspend fun stop(): Unit = app.coroutineScope.async(IO) {
        listenJob.cancel()
        app.socketMessageReceiver.stop()
        app.socketMessageSender.stop()
        closeAllConnections()
        socket.close()
    }.await()

    internal suspend fun closeAllConnections(): Unit =
        connections.keys.forEach { closeConnection(it) }

    private suspend fun closeConnection(socketHash: SocketHashCode): Socket? =
        app.coroutineScope.async(IO) {
            connections[socketHash]?.close()
            connections.remove(socketHash)
        }.await()
}