package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.SignalMessageSender.Companion.asAddress
import info.signalboost.signalc.model.*
import info.signalboost.signalc.util.SocketHashCode
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import kotlin.Error
import kotlin.time.Duration
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketMessageReceiver(private val app: Application) {
    internal val readers = ConcurrentHashMap<SocketHashCode, BufferedReader>()

    // NOTE: this singleton is mainly here as a testing seam, but could be
    // repurposed as a site to easily swap our reader implementation
    object Reader {
        fun of(socket: Socket) =
            BufferedReader(InputStreamReader(socket.getInputStream()))
    }

    /************
     * LIFECYCLE
     ************/

    suspend fun connect(socket: Socket): Job =
        app.coroutineScope.launch(IO) {
            Reader.of(socket).use { reader ->
                val socketHash = socket.hashCode().also { readers[it] = reader }
                while (this.isActive && readers[socketHash] != null) {
                    val socketMessage = reader.readLine() ?: run {
                        disconnect(socketHash)
                        return@launch
                    }
                    println("got message on socket $socketHash: $socketMessage")
                    app.coroutineScope.launch(IO) {
                        dispatch(socketMessage, socketHash)
                    }
                }
            }
        }

    suspend fun disconnect(socketHash: SocketHashCode, listenJob: Job? = null) {
        val reader = readers[socketHash] ?: return // must have already been disconnected!
        readers.remove(socketHash) // will terminate loop and complete Job launched by `connect`
        app.coroutineScope.launch(IO) {
            try {
                reader.close()
            } catch(e: Throwable) {
                println("Error closing reader on socket $socketHash: $e")
            }
            println("Closed reader from socket $socketHash")
        }
        app.socketServer.disconnect(socketHash)
    }

    suspend fun stop() = readers.keys.forEach { disconnect(it) }

    /*******************
     * MESSAGE HANDLING
     *******************/

    private suspend fun dispatch(socketMessage: String, socketHash: SocketHashCode) {
        // PLACEHOLDER!
        val (username, cmd, message) =
            if (socketMessage.count { it == ',' } == 2) socketMessage.split(",")
            else listOf("",socketMessage,"")

        try {
            when (cmd) {
                "abort" -> {
                    println("Received `abort`. exiting.")
                    app.socketMessageSender.send(Shutdown(socketHash))
                    app.stop()
                }
                "close" -> disconnect(socketHash)
                // TODO: un-hardcode sender
                "send" -> send(Config.USER_PHONE_NUMBER, username, message) // NOTE: this signals errors in return value and Throwable
                "subscribe" -> subscribe(username)
                else ->
                    app.socketMessageSender.send(CommandInvalid(cmd, socketMessage))
            }
        } catch(e: Throwable) {
            // TODO: dispatch errors here (and fan-in with `ResultStatus` returned from `send`)
            println("ERROR executing command $cmd from socket $socketHash: $e")
            app.socketMessageSender.send(CommandExecutionError(cmd, e))
        }
    }

    // TODO: likely return Unit here instead of Job? (do we ever want to cancel it?)
    private suspend fun send(sender: String, recipient: String, msg: String): Job {
        val account: VerifiedAccount = app.accountManager.loadVerified(sender)
            ?: return app.socketMessageSender.send(
                CommandExecutionError("send", Error("Can't send to $sender: not registered."))
            )
        val sendResult = app.signalMessageSender.send(account, recipient.asAddress(), msg)
        // TODO: handle following cases:
        // - sendResult.success (yay!)
        // - sendResult.identityFailure (b/c safety number change)
        // - sendResult.isUnregisteredFailure (b/c user not on signal)
        // - sendResult.isNetworkFailure (likely retry?)
        return if (sendResult.success != null) {
            println("Sent message to $recipient.")
            app.socketMessageSender.send(SendSuccess)
        }
        else {
            println("Failed to send $msg to $recipient.")
            app.socketMessageSender.send(SendFailure)
        }
    }


    private suspend fun subscribe(username: String, retryDelay: Duration = 1.milliseconds) {
        println("Subscribing to messages for ${username}...")
        val account: VerifiedAccount = app.accountManager.loadVerified(Config.USER_PHONE_NUMBER)
            ?: return run {
                app.socketMessageSender.send(
                    CommandExecutionError("subscribe", Error("Can't subscribe to messages for $username: not registered."))
                )
                Unit
            }

        val subscribeJob = app.signalMessageReceiver.subscribe(account)
        app.socketMessageSender.send(SubscriptionSucceeded)
        println("...subscribed to messages for ${account.username}.")

        subscribeJob.invokeOnCompletion {
            // TODO: Think about this more carefully...
            val error = it?.cause ?: return@invokeOnCompletion
            app.coroutineScope.launch(IO) {
                when(error) {
                    is SignalcError.MessagePipeNotCreated -> {
                        println("...error subscribing to messages for ${account.username}: ${error}.")
                        app.socketMessageSender.send(SubscriptionFailed(error))
                    }
                    else -> {
                        println("subscription to ${account.username} disrupted: ${error.cause}. Resubscribing...")
                        app.socketMessageSender.send(SubscriptionDisrupted(error))
                        delay(retryDelay)
                        subscribe(username, retryDelay * 2)
                    }
                }
            }
        }
    }
}