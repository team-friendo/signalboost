package info.signalboost.signalc.testSupport.socket

import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import kotlinx.coroutines.channels.*
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import okhttp3.internal.closeQuietly
import org.newsclub.net.unix.AFUNIXSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.Socket
import java.util.concurrent.atomic.AtomicInteger
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@ExperimentalTime
@ExperimentalCoroutinesApi
class TestSocketClient private constructor(
    private val socket: Socket,
    private val writer: PrintWriter,
    private val reader: BufferedReader,
    private val out: Channel<String>,
    private val listenJob: Job,
    private val scope: CoroutineScope,
    private val numReceived: AtomicInteger,
    ) {

    companion object {
        const val READ_BUFFER_SIZE = 10

        suspend fun connect(path: String, scope: CoroutineScope): TestSocketClient = scope.async {
            val out = Channel<String>(READ_BUFFER_SIZE)
            val numReceived = AtomicInteger()
            lateinit var listenJob: Job

            val socket =AFUNIXSocket.newInstance().also {
                it.connect(AFUNIXSocketAddress(File(path)))
            } as Socket
            val writer = PrintWriter(socket.getOutputStream(), true)
            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))

            listenJob = scope.launch(IO) {
                while(this.isActive && !out.isClosedForReceive && !socket.isClosed) {
                    val msg = reader.readLine() ?: return@launch
                    println("Test client ${socket.hashCode()} got msg: $msg")
                    out.send(msg)
                    numReceived.getAndIncrement()
                }
            }

            TestSocketClient(socket, writer, reader, out, listenJob, scope, numReceived)
        }.await()
    }



    suspend fun send(msg: String) = scope.async {
        writer.println(msg)
    }.await()

    private suspend fun receive(): String = out.receive()
    private suspend fun receiveN(n: Int): List<String> = List(n) { receive() }
    suspend fun drain(): List<String> = receiveN(numReceived.get())

    suspend fun close() = scope.async {
        out.cancel()
        listenJob.cancel()
    }.await()

}