package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
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
    object ReaderFactory {
        fun readerOn(socket: Socket) =
            BufferedReader(InputStreamReader(socket.getInputStream()))
    }

    /************
     * LIFECYCLE
     ************/

    suspend fun connect(socket: Socket): Job =
        app.coroutineScope.launch(IO) {
            ReaderFactory.readerOn(socket).use { reader ->
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
        val inMsg = SocketRequest.fromJson(socketMessage)
        try {
            when (inMsg) {
                is SocketRequest.Abort -> {
                    println("Received `abort`. exiting.")
                    app.socketMessageSender.send(Shutdown(socketHash))
                    app.stop()
                }
                is SocketRequest.Close -> disconnect(socketHash)
                is SocketRequest.Send -> send(inMsg)  // NOTE: this signals errors in return value and Throwable
                is SocketRequest.Subscribe -> subscribe(inMsg)
                is SocketRequest.ParseError ->
                    app.socketMessageSender.send(CommandInvalidException(inMsg.cause, inMsg.input))
            }
        } catch(e: Throwable) {
            // TODO: dispatch errors here (and fan-in with `ResultStatus` returned from `send`)
            println("ERROR executing command $inMsg from socket $socketHash: $e")
            app.socketMessageSender.send(CommandExecutionException(e, inMsg))
        }
    }

    // TODO: likely return Unit here instead of Job? (do we ever want to cancel it?)
    // private suspend fun send(sender: String, recipient: String, msg: String): Unit {
    private suspend fun send(sendRequest: SocketRequest.Send): Unit {
        val (_, recipientAddress, messageBody) = sendRequest
        val senderAccount: VerifiedAccount = app.accountManager.loadVerified(sendRequest.username)
            ?: return app.socketMessageSender.send(
                CommandExecutionException(
                    Error("Can't send to ${sendRequest.username}: not registered."),
                    sendRequest
                )
            )
        val sendResult = app.signalMessageSender.send(
            senderAccount,
            recipientAddress.asSignalAddress(),
            messageBody
        )
        // TODO: handle following cases:
        // - sendResult.success (yay!)
        // - sendResult.identityFailure (b/c safety number change)
        // - sendResult.isUnregisteredFailure (b/c user not on signal)
        // - sendResult.isNetworkFailure (likely retry?)
        return if (sendResult.success != null) {
            println("Sent message to ${recipientAddress.number}")
            app.socketMessageSender.send(SendSuccess)
        }
        else {
            println("Failed to send $messageBody to $recipientAddress.number.")
            app.socketMessageSender.send(SendFailure)
        }
    }


    private suspend fun subscribe(subscribeRequest: SocketRequest.Subscribe, retryDelay: Duration = 1.milliseconds) {
        val (username) = subscribeRequest
        println("Subscribing to messages for ${username}...")
        val account: VerifiedAccount = app.accountManager.loadVerified(Config.USER_PHONE_NUMBER)
            ?: return run {
                app.socketMessageSender.send(
                    CommandExecutionException(
                        Error("Can't subscribe to messages for $username: not registered."),
                        subscribeRequest,
                    )
                )
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
                        subscribe(subscribeRequest, retryDelay * 2)
                    }
                }
            }
        }
    }
}