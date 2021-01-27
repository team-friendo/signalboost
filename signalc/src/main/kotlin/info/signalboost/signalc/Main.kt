package info.signalboost.signalc

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import org.newsclub.net.unix.AFUNIXServerSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.Socket
import kotlin.system.exitProcess


/*************
 * MAIN LOOP
 *************/

@ExperimentalCoroutinesApi
fun main() = runBlocking {
    val app = Application(Config.fromEnv(), this)

    // TODO: "turn server on" in App.run()?
    val server =  AFUNIXServerSocket.newInstance().apply {
        bind(AFUNIXSocketAddress(File(app.socket.path)))
    }

    // send messages...
    val listenForSocketMessages: Job = launch {
        server.use {
            withContext(Dispatchers.IO) {
                while (true) {
                    val sock = it.accept() as Socket
                    println("got connection!")
                    launch {
                        SocketMessageDispatcher(app, sock).subscribe()
                    }
                }
            }
        }
    }

    println("running...")
    listenForSocketMessages.join()
}

@ExperimentalCoroutinesApi
class SocketMessageDispatcher(
    val app: Application,
    // TODO: hmmm....
    val socket: Socket,
    val socketReceiver: SocketMessageReceiver = SocketMessageReceiver(app),
    val socketSender: SocketMessageSender = SocketMessageSender(app, socket),
) {
    suspend fun subscribe(): ReceiveChannel<String> {
        val incoming = socketReceiver.listen(socket)
        val outgoing = Channel<String>()

        while(!incoming.isClosedForReceive && !outgoing.isClosedForSend) {
            val msg = incoming.receive()
            dispatch(msg, socket, socketSender)
        }

        return outgoing
    }

    private suspend fun dispatch(msg: String, socket: Socket, sender: SocketMessageSender) {
        when (msg) {
            "abort" -> {
                println("received 'abort'. exiting.")
                sender.send("bye!")
                exitProcess(0)
            }
            else -> sender.send(msg)
        }
    }
}

class SocketMessageReceiver(app: Application) {
    val coroutineScope = app.coroutineScope

    suspend fun listen(socket: Socket): ReceiveChannel<String> {
        val out = Channel<String>()

        coroutineScope.launch(Dispatchers.IO) {
            // TODO: is this a good way to handle this resource?
            BufferedReader(InputStreamReader(socket.getInputStream())).use {
                while(true) {
                    withContext(Dispatchers.IO) {
                        val msg = it.readLine() ?: "abort"
                        out.send(msg)
                    }
                }
            }
        }

        return out
    }
}

class SocketMessageSender(app: Application, socket: Socket) {
    // TODO: hmm...
    //   - right now, we error if we don't recycle this writer across writes
    //   - but it forces us to pass an instance of `socket` to the constructor
    //   - aaand it prevents us from cleanly cleaning up resources with `.use`
    //   - can we do better?
    private val writer by lazy {
        PrintWriter(socket.getOutputStream(), true)
    }

    suspend fun send(msg: String) {
        withContext(Dispatchers.IO) {
            writer.println(msg)
        }
    }
}