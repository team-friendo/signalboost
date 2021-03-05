package info.signalboost.signalc.testSupport.socket

import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
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
import kotlin.time.Duration
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@ExperimentalTime
@ExperimentalCoroutinesApi
class TestSocketClient private constructor(
    private val socket: Socket,
    private val writer: PrintWriter,
    private val out: SendChannel<String>,
    private val scope: CoroutineScope,
    ) {

    companion object: Any(), KLoggable {
        override val logger = logger()

        private const val READ_BUFFER_SIZE = 10

        suspend fun connect(
            path: String,
            scope: CoroutineScope,
            out: SendChannel<String> = Channel(READ_BUFFER_SIZE)
        ): TestSocketClient = scope.async(IO) {

            val socket =AFUNIXSocket.newInstance().also {
                it.connect(AFUNIXSocketAddress(File(path)))
            } as Socket
            val writer = PrintWriter(socket.getOutputStream(), true)
            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))

            logger.debug("Test client running...")
            scope.launch(IO) {
                while(this.isActive && !out.isClosedForSend && !socket.isClosed) {
                    val msg = reader.readLine() ?: return@launch
                    logger.debug("Test client ${socket.hashCode()} got msg: $msg")
                    out.send(msg)
                }
            }

            TestSocketClient(socket, writer, out, scope)
        }.await()
    }



    suspend fun send(msg: String, wait: Duration = 0.milliseconds) = scope.async(IO) {
        writer.println(msg)
        delay(wait)
    }.await()

    suspend fun close() = scope.async {
        out.close()
        socket.closeQuietly()
        writer.closeQuietly()
    }.await()

    val isClosed: Boolean
        get() = out.isClosedForSend || socket.isClosed

}