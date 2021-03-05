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
                    app.socketReceiver.connect(connection)
                    logger.info("Connected receiver to socket $socketHash")
                    app.socketSender.connect(connection)
                    logger.info("Connected sender to socket $socketHash")
                }
            }
        }

        return this
    }

    suspend fun close(socketHash: SocketHashCode): Unit = withContext(Dispatchers.IO) {
        logger.info("Closing connection on socket $socketHash...")
        app.socketSender.close(socketHash)
        app.socketReceiver.close(socketHash)
        closeConnection(socketHash)
        logger.info("... closed connection on socket $socketHash")
    }

    suspend fun stop(): Unit = app.coroutineScope.async(IO) {
        logger.info("Stopping socket server...")
        listenJob.cancel() // cancel listen loop first so we don't handle any messages during shutdown
        app.socketReceiver.stop()
        app.socketSender.stop()
        closeAllConnections()
        socket.close()
        logger.info("... socket server stopped.")
    }.await()

    internal suspend fun closeAllConnections(): Unit =
        connections.keys.forEach { closeConnection(it) }

    private suspend fun closeConnection(socketHash: SocketHashCode): Socket? =
        app.coroutineScope.async(IO) {
            connections[socketHash]?.close()
            connections.remove(socketHash)
        }.await()
}