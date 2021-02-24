package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.error.SignalcError
import info.signalboost.signalc.model.*
import info.signalboost.signalc.model.SendResultType.Companion.type
import info.signalboost.signalc.util.SocketHashCode
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import org.whispersystems.signalservice.api.messages.SendMessageResult
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
                    app.socketMessageSender.send(SocketResponse.Shutdown(socketHash))
                    app.stop()
                }
                is SocketRequest.Close -> disconnect(socketHash)
                is SocketRequest.Send -> send(inMsg)  // NOTE: this signals errors in return value and Throwable
                is SocketRequest.Subscribe -> subscribe(inMsg)
                is SocketRequest.ParseError ->
                    app.socketMessageSender.send(SocketResponse.RequestInvalidError(inMsg.error, inMsg.input))
            }
        } catch(e: Throwable) {
            // TODO: dispatch errors here (and fan-in with `ResultStatus` returned from `send`)
            println("ERROR executing command $inMsg from socket $socketHash: $e")
            app.socketMessageSender.send(
                SocketResponse.RequestHandlingErrorLegacy(e, inMsg)
            )
        }
    }

    // TODO: likely return Unit here instead of Job? (do we ever want to cancel it?)
    // private suspend fun send(sender: String, recipient: String, msg: String): Unit {
    private suspend fun send(sendRequest: SocketRequest.Send): Unit {
        val (_, _, recipientAddress, messageBody) = sendRequest
        val senderAccount: VerifiedAccount = app.accountManager.loadVerified(sendRequest.username)
            ?: return app.socketMessageSender.send(
                SocketResponse.RequestHandlingErrorLegacy(
                    Error("Can't send to ${sendRequest.username}: not registered."),
                    sendRequest
                )
            )
        val sendResult: SendMessageResult = app.signalMessageSender.send(
            senderAccount,
            recipientAddress.asSignalAddress(),
            messageBody
        )
        when(sendResult.type()){
            SendResultType.SUCCESS -> app.socketMessageSender.send(SocketResponse.SendSuccessLegacy)
            else -> app.socketMessageSender.send(SocketResponse.SendErrorLegacy)
        }
        // TODO:
        //  - sendResult has 5 variant cases (success, network failure, identity failure, unregistered, unknown)
        //  - should we do any special handling for non-success cases?
        // app.socketMessageSender.send(SocketResponse.SendResult.of(sendRequest, sendResult))
    }


    private suspend fun subscribe(subscribeRequest: SocketRequest.Subscribe, retryDelay: Duration = 1.milliseconds) {
        val (_,username) = subscribeRequest
        println("Subscribing to messages for ${username}...")
        val account: VerifiedAccount = app.accountManager.loadVerified(Config.USER_PHONE_NUMBER)
            ?: return run {
                app.socketMessageSender.send(
                    SocketResponse.SubscriptionFailedLegacy(SignalcError.UnregisteredUser(username))
                )
            }

        val subscribeJob = app.signalMessageReceiver.subscribe(account)
        app.socketMessageSender.send(SocketResponse.SubscriptionSuccessLegacy)
        println("...subscribed to messages for ${account.username}.")

        subscribeJob.invokeOnCompletion {
            // TODO: Think about this more carefully...
            val error = it?.cause ?: return@invokeOnCompletion
            app.coroutineScope.launch(IO) {
                when(error) {
                    is SignalcError.MessagePipeNotCreated -> {
                        println("...error subscribing to messages for ${account.username}: ${error}.")
                        app.socketMessageSender.send(SocketResponse.SubscriptionFailedLegacy(error))
                    }
                    else -> {
                        println("subscription to ${account.username} disrupted: ${error.cause}. Resubscribing...")
                        app.socketMessageSender.send(SocketResponse.SubscriptionDisruptedLegacy(error))
                        delay(retryDelay)
                        subscribe(subscribeRequest, retryDelay * 2)
                    }
                }
            }
        }
    }
}