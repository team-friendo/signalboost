package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.error.SignalcError
import info.signalboost.signalc.model.*
import info.signalboost.signalc.util.SocketHashCode
import info.signalboost.signalc.util.StringUtil.asSanitizedCode
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import mu.KLogging
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
class SocketReceiver(private val app: Application) {
    companion object: KLogging()

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
                        close(socketHash)
                        return@launch
                    }
                    logger.debug { "got message on socket $socketHash: $socketMessage" }
                    app.coroutineScope.launch(IO) {
                        dispatch(socketMessage, socketHash)
                    }
                }
            }
        }

    suspend fun close(socketHash: SocketHashCode) {
        readers[socketHash] ?: return // must have already been disconnected!
        readers.remove(socketHash) // will terminate loop and complete Job launched by `connect`
        app.socketServer.close(socketHash)
    }

    suspend fun stop() = readers.keys.forEach { close(it) }

    /*******************
     * MESSAGE HANDLING
     *******************/

    private suspend fun dispatch(socketMessage: String, socketHash: SocketHashCode) {
        val request = SocketRequest.fromJson(socketMessage)
        try {
            when (request) {
                is SocketRequest.Abort -> abort(request, socketHash)
                is SocketRequest.Close -> close(socketHash)
                is SocketRequest.ParseError -> parseError(request)
                is SocketRequest.Register -> register(request)
                is SocketRequest.Send -> send(request)  // NOTE: this signals errors in return value and Throwable
                is SocketRequest.Subscribe -> subscribe(request)
                is SocketRequest.Verify -> verify(request)
                // TODO://////////////////////////////////////////////
                is SocketRequest.SetExpiration -> unimplemented(request)
                is SocketRequest.Trust -> unimplemented(request)
                is SocketRequest.Unsubscribe -> unimplemented(request)
                is SocketRequest.Version -> unimplemented(request)
            }
        } catch(e: Throwable) {
            // TODO: dispatch errors here (and fan-in with `ResultStatus` returned from `send`)
            logger.error("ERROR handling request $request from socket $socketHash: $e")
            app.socketSender.send(
                SocketResponse.RequestHandlingError(request.id(), e, request)
            )
        }
    }

    // HANDLE SPECIAL CASES

    private suspend fun unimplemented(request: SocketRequest): Unit = app.socketSender.send(
        SocketResponse.RequestHandlingError(
            request.id(),
            Exception("handler for ${request.javaClass.name} not implemented yet!"),
            request
        )
    )


    private suspend fun parseError(request: SocketRequest.ParseError): Unit = app.socketSender.send(
        SocketResponse.RequestInvalidError(request.error, request.input)
    )

    // HANDLE COMMANDS

    private suspend fun abort(request: SocketRequest.Abort, socketHash: SocketHashCode) {
        logger.info("Received `abort`. Exiting.")
        app.socketSender.send(SocketResponse.AbortWarning(request.id, socketHash))
        app.stop()
    }

    private suspend fun register(request: SocketRequest.Register): Unit = try {
        when(val account = app.accountManager.load(request.username)) {
            // TODO: handle re-registration here
            is RegisteredAccount, is VerifiedAccount -> app.socketSender.send(
                SocketResponse.RegistrationError.of(request, SignalcError.RegistrationOfRegsisteredUser)
            )
            is NewAccount -> {
                app.accountManager.register(account, request.captcha)
                app.socketSender.send(SocketResponse.RegistrationSuccess.of(request))
            }
        }
    } catch(e: Throwable) {
        logger.error { e.printStackTrace() }
        app.socketSender.send(SocketResponse.RegistrationError.of(request, e))
    }


    // TODO: likely return Unit here instead of Job? (do we ever want to cancel it?)
    private suspend fun send(sendRequest: SocketRequest.Send) {
        val (_, _, recipientAddress, messageBody) = sendRequest
        val senderAccount: VerifiedAccount = app.accountManager.loadVerified(sendRequest.username)
            ?: return app.socketSender.send(
                SocketResponse.RequestHandlingError(
                    sendRequest.id,
                    Error("Can't send to ${sendRequest.username}: not registered."),
                    sendRequest
                )
            )
        val sendResult: SendMessageResult = app.signalSender.send(
            senderAccount,
            recipientAddress.asSignalServiceAddress(),
            messageBody
        )
        // TODO:
        //  - sendResult has 5 variant cases (success, network failure, identity failure, unregistered, unknown)
        //  - should we do any special handling for non-success cases? (currently we don't!)
        app.socketSender.send(SocketResponse.SendResults.of(sendRequest, sendResult))
    }


    private suspend fun subscribe(request: SocketRequest.Subscribe, retryDelay: Duration = 1.milliseconds) {
        val (id,username) = request
        logger.info("Subscribing to messages for ${username}...")
        val account: VerifiedAccount = app.accountManager.loadVerified(username)
            ?: return run {
                app.socketSender.send(
                    SocketResponse.SubscriptionFailed(id, SignalcError.SubscriptionOfUnregisteredUser)
                )
            }

        val subscribeJob = app.signalReceiver.subscribe(account)
        app.socketSender.send(SocketResponse.SubscriptionSuccess.of(request))
        logger.info("...subscribed to messages for ${account.username}.")

        subscribeJob.invokeOnCompletion {
            // TODO: Think about this more carefully...
            val error = it?.cause ?: return@invokeOnCompletion
            app.coroutineScope.launch(IO) {
                when(error) {
                    is SignalcError.MessagePipeNotCreated -> {
                        logger.error { "...error subscribing to messages for ${account.username}: ${error}." }
                        app.socketSender.send(SocketResponse.SubscriptionFailed(id, error))
                    }
                    else -> {
                        logger.error { "subscription to ${account.username} disrupted: ${error.cause}. Resubscribing..." }
                        app.socketSender.send(SocketResponse.SubscriptionDisrupted(id, error))
                        delay(retryDelay)
                        subscribe(request, retryDelay * 2)
                    }
                }
            }
        }
    }

    private suspend fun verify(request: SocketRequest.Verify): Unit = try {
        when(val account = app.accountManager.load(request.username)) {
            is NewAccount -> app.socketSender.send(
                SocketResponse.VerificationError.of(request, SignalcError.VerificationOfNewUser)
            )
            is VerifiedAccount -> app.socketSender.send(
                SocketResponse.VerificationError.of(request, SignalcError.VerificationOfVerifiedUser)
            )
            is RegisteredAccount -> {
                app.accountManager.verify(account, request.code.asSanitizedCode())?.let {
                    app.accountManager.publishPreKeys(it)
                    app.socketSender.send(SocketResponse.VerificationSuccess.of(request))
                } ?: run {
                    app.socketSender.send(SocketResponse.VerificationError.of(request, SignalcError.AuthorizationFailed))
                }
            }
        }
    } catch(error: Throwable) {
        app.socketSender.send(SocketResponse.VerificationError.of(request, error))
    }
}