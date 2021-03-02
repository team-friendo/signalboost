package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.util.*
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import mu.KLogging
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
    companion object: KLogging()

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
                logger.info("Listening on ${app.config.socket.path}...")
                val connection = try {
                    socket.accept() as Socket
                } catch (e: Throwable) {
                    logger.error("Connection disrupted: ${e.message}")
                    return@launch stop()
                }
                val socketHash = connection.hashCode().also { connections[it] = connection }
                logger.info("Got connection on socket $socketHash")
                launch(IO) {
                    app.socketMessageReceiver.connect(connection)
                    logger.info("Connected reader to socket $socketHash")
                    app.socketMessageSender.connect(connection)
                    logger.info("Connected writer to socket $socketHash")
                }
            }
        }

        return this
    }

    suspend fun close(socketHash: SocketHashCode): Unit = withContext(Dispatchers.IO) {
        app.socketMessageSender.close(socketHash)
        app.socketMessageReceiver.close(socketHash)
        closeConnection(socketHash)
        logger.info("Closed connection on socket $socketHash")
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