package info.signalboost.signalc.testSupport.socket

import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.Unconfined
import kotlinx.coroutines.channels.*
import mu.KLoggable
import okhttp3.internal.closeQuietly
import org.newsclub.net.unix.AFUNIXSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.Socket
import java.util.concurrent.Executors
import kotlin.time.Duration
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@ExperimentalTime
@ExperimentalCoroutinesApi
class TestSocketClient private constructor(
    private val socket: Socket,
    private val writer: PrintWriter,
    private val reader: BufferedReader,
    private val out: SendChannel<String>,
    private val scope: CoroutineScope,
    private val listenJob: Job,
) {

    companion object: Any(), KLoggable {
        private const val READ_BUFFER_SIZE = 10
        override val logger = logger()
        private val dispatcher = Executors.newCachedThreadPool().asCoroutineDispatcher()

        suspend fun connect(
            path: String,
            scope: CoroutineScope,
            out: SendChannel<String> = Channel(READ_BUFFER_SIZE),
        ): TestSocketClient = withContext(Unconfined) {

            val socket =AFUNIXSocket.newInstance().also {
                it.connect(AFUNIXSocketAddress(File(path)))
            } as Socket
            val writer = PrintWriter(socket.getOutputStream(), true)
            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))

            logger.debug("Test client running...")
            val listenJob = scope.launch(dispatcher) {
                while(this.isActive && !out.isClosedForSend && !socket.isClosed) {
                    val msg = reader.readLine() ?: return@launch
                    logger.debug("Test client ${socket.hashCode()} got msg: $msg")
                    out.send(msg)
                }
            }

            TestSocketClient(socket, writer, reader, out, scope, listenJob)
        }
    }



    suspend fun send(msg: String, wait: Duration = 0.milliseconds) = scope.async(dispatcher) {
        writer.println(msg)
        delay(wait)
    }.await()

    suspend fun close() = scope.async(dispatcher) {
        out.close()
        listenJob.cancel()
        socket.closeQuietly()
        writer.closeQuietly()
        reader.closeQuietly()
    }.await()

    val isClosed: Boolean
        get() = out.isClosedForSend || socket.isClosed

}