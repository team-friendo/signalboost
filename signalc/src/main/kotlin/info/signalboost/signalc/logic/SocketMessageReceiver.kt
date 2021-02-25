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
        val request = SocketRequest.fromJson(socketMessage)
        try {
            when (request) {
                is SocketRequest.Abort -> abort(request, socketHash)
                is SocketRequest.Close -> disconnect(socketHash)
                is SocketRequest.ParseError -> parseError(request)
                is SocketRequest.Send -> send(request)  // NOTE: this signals errors in return value and Throwable
                is SocketRequest.Subscribe -> subscribe(request)
                // TODO://////////////////////////////////////////////
                is SocketRequest.Register -> unimplemented(request)
                is SocketRequest.SetExpiration -> unimplemented(request)
                is SocketRequest.Trust -> unimplemented(request)
                is SocketRequest.Unsubscribe -> unimplemented(request)
                is SocketRequest.Verify -> unimplemented(request)
                is SocketRequest.Version -> unimplemented(request)
            }
        } catch(e: Throwable) {
            // TODO: dispatch errors here (and fan-in with `ResultStatus` returned from `send`)
            println("ERROR executing command $request from socket $socketHash: $e")
            app.socketMessageSender.send(
                SocketResponse.RequestHandlingError(request.id(), e, request)
            )
        }
    }

    private suspend fun unimplemented(request: SocketRequest) {
        app.socketMessageSender.send(
            SocketResponse.RequestHandlingError(
                request.id(),
                Exception("handler for ${request.javaClass.name} not implemented yet!"),
                request
            )
        )
    }


    private suspend fun abort(request: SocketRequest.Abort, socketHash: SocketHashCode) {
        println("Received `abort`. Exiting.")
        app.socketMessageSender.send(SocketResponse.AbortWarning(request.id, socketHash))
        app.stop()
    }


    private suspend fun parseError(request: SocketRequest.ParseError) {
        app.socketMessageSender.send(
            SocketResponse.RequestInvalidError(request.error, request.input)
        )
    }

    // TODO: likely return Unit here instead of Job? (do we ever want to cancel it?)
    private suspend fun send(sendRequest: SocketRequest.Send) {
        val (_, _, recipientAddress, messageBody) = sendRequest
        val senderAccount: VerifiedAccount = app.accountManager.loadVerified(sendRequest.username)
            ?: return app.socketMessageSender.send(
                SocketResponse.RequestHandlingError(
                    sendRequest.id,
                    Error("Can't send to ${sendRequest.username}: not registered."),
                    sendRequest
                )
            )
        val sendResult: SendMessageResult = app.signalMessageSender.send(
            senderAccount,
            recipientAddress.asSignalAddress(),
            messageBody
        )
        // TODO:
        //  - sendResult has 5 variant cases (success, network failure, identity failure, unregistered, unknown)
        //  - should we do any special handling for non-success cases? (currently we don't!)
        app.socketMessageSender.send(SocketResponse.SendResults.of(sendRequest, sendResult))
    }


    private suspend fun subscribe(request: SocketRequest.Subscribe, retryDelay: Duration = 1.milliseconds) {
        val (id,username) = request
        println("Subscribing to messages for ${username}...")
        val account: VerifiedAccount = app.accountManager.loadVerified(Config.USER_PHONE_NUMBER)
            ?: return run {
                app.socketMessageSender.send(
                    SocketResponse.SubscriptionFailed(id, SignalcError.UnregisteredUser(username))
                )
            }

        val subscribeJob = app.signalMessageReceiver.subscribe(account)
        app.socketMessageSender.send(SocketResponse.SubscriptionSuccess(id))
        println("...subscribed to messages for ${account.username}.")

        subscribeJob.invokeOnCompletion {
            // TODO: Think about this more carefully...
            val error = it?.cause ?: return@invokeOnCompletion
            app.coroutineScope.launch(IO) {
                when(error) {
                    is SignalcError.MessagePipeNotCreated -> {
                        println("...error subscribing to messages for ${account.username}: ${error}.")
                        app.socketMessageSender.send(SocketResponse.SubscriptionFailed(id, error))
                    }
                    else -> {
                        println("subscription to ${account.username} disrupted: ${error.cause}. Resubscribing...")
                        app.socketMessageSender.send(SocketResponse.SubscriptionDisrupted(id, error))
                        delay(retryDelay)
                        subscribe(request, retryDelay * 2)
                    }
                }
            }
        }
    }
}