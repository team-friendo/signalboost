package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.exception.SignalcCancellation
import info.signalboost.signalc.exception.SignalcError
import info.signalboost.signalc.dispatchers.Concurrency
import info.signalboost.signalc.metrics.Metrics
import info.signalboost.signalc.model.*
import info.signalboost.signalc.util.SocketHashCode
import info.signalboost.signalc.util.StringUtil.asSanitizedCode
import kotlinx.coroutines.*
import mu.KLogging
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import kotlin.Error
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ExperimentalPathApi
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
        app.coroutineScope.launch(Concurrency.Dispatcher) {
            ReaderFactory.readerOn(socket).use { reader ->
                val socketHash = socket.hashCode().also { readers[it] = reader }
                while (this.isActive && readers[socketHash] != null) {
                    val socketMessage = reader.readLine() ?: run {
                        close(socketHash)
                        return@launch
                    }
                    app.coroutineScope.launch(Concurrency.Dispatcher) {
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
                is SocketRequest.IsAlive -> isAlive(request)
                is SocketRequest.ParseError -> parseError(request)
                is SocketRequest.Register -> register(request)
                is SocketRequest.Send -> send(request)  // this signals errors as both `SendResult` and `Throwable`
                is SocketRequest.SetExpiration -> setExpiration(request)
                is SocketRequest.Subscribe -> subscribe(request)
                is SocketRequest.Trust -> trust(request)
                is SocketRequest.Unsubscribe -> unsubscribe(request)
                is SocketRequest.Verify -> verify(request)
            }
        } catch(e: Throwable) {
            logger.error("ERROR handling request $request from socket $socketHash:\n ${e.stackTraceToString()}")
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
        logger.info("Received `abort`, exiting...")
        app.socketSender.send(SocketResponse.AbortWarning(request.id, socketHash))
        app.exit(0)
    }

    private suspend fun isAlive(request: SocketRequest.IsAlive) {
        app.socketSender.send(SocketResponse.IsAlive(request.id))
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
        app.socketSender.send(SocketResponse.RegistrationError.of(request, e))
        logger.error { "Error registering account:\n ${e.stackTraceToString()}" }
    }


    // TODO: likely return Unit here instead of Job? (do we ever want to cancel it?)
    private suspend fun send(request: SocketRequest.Send) {
        val (_, _, recipientAddress, messageBody, attachments, expiresInSeconds) = request

        val timeToLoadAccountTimer = Metrics.AccountManager.timeToLoadVerifiedAccount.startTimer()
        val senderAccount: VerifiedAccount = app.accountManager.loadVerified(request.username)
            ?: return request.rejectUnverified()
        timeToLoadAccountTimer.observeDuration()

        val sendResult = app.signalSender.send(senderAccount, recipientAddress, messageBody, expiresInSeconds, attachments)

        when(sendResult) {
            // TODO: QA this as part of https://0xacab.org/team-friendo/signalboost/-/issues/419
            is SignalcSendResult.IdentityFailure -> app.protocolStore.of(senderAccount).saveIdentity(
                recipientAddress.asSignalProtocolAddress(),
                sendResult.identityKey,
            ).also { didUpdateExisting ->
                if(!didUpdateExisting) logger.warn {
                    // TODO(aguestuser|2021-06-02): maybe error here?
                    val (fingerprint, id) = Pair(sendResult.identityKey.fingerprint, recipientAddress.identifier)
                    "Expected to update identity key for contact $id, but instead created identity key $fingerprint."
                }
            }
            is SignalcSendResult.Success -> {
                Metrics.LibSignal.timeSpentSendingMessage.observe(sendResult.duration.toDouble())
            }
            // (currently) ignore: Blocked, NetworkFailure, UnregisteredFailure, UnknownError
            else -> {}
        }

        app.socketSender.send(SocketResponse.SendResults.of(request, sendResult))
    }

    private suspend fun setExpiration(request: SocketRequest.SetExpiration) {
        val(_, _, recipientAddress,expiresInSeconds) = request
        val senderAccount: VerifiedAccount = app.accountManager.loadVerified(request.username)
            ?: return request.rejectUnverified()
        val sendResult = app.signalSender.setExpiration(
            senderAccount,
            recipientAddress,
            expiresInSeconds
        )
        when(sendResult) {
            is SignalcSendResult.Success -> app.socketSender.send(SocketResponse.SetExpirationSuccess.of(request))
            else -> app.socketSender.send(SocketResponse.SetExpirationFailed.of(request, sendResult))
        }
    }

    private suspend fun subscribe(request: SocketRequest.Subscribe) {
        val (id,username) = request
        val account: VerifiedAccount = app.accountManager.loadVerified(username) ?: return request.rejectUnverified()

        logger.info("Subscribing to messages for ${username}...")
        val subscribeJob = app.signalReceiver.subscribe(account) ?:
           return app.socketSender.send(SocketResponse.SubscriptionFailed(id, Error("Already subscribed to $username.")))
        app.socketSender.send(SocketResponse.SubscriptionSuccess.of(request))
        logger.info("...subscribed to messages for ${account.username}.")

        subscribeJob.invokeOnCompletion {
            // if job did not error, return early, else get either the error or its wrapped cause
            val error = it?.let {  it.cause ?: it } ?: return@invokeOnCompletion
            app.coroutineScope.launch(Concurrency.Dispatcher) {
                when(error) {
                    is SignalcCancellation.SubscriptionCancelledByClient -> {
                        logger.info { "...subscription job for ${account.username} cancelled." }
                    }
                    is SignalcCancellation.SubscriptionDisrupted -> {
                        logger.error { "Subscription to ${account.username} disrupted: ${error.cause}. Resubscribing..." }
                        Metrics.SocketReceiver.numberOfResubscribes.inc()
                        app.socketSender.send(SocketResponse.SubscriptionDisrupted(id, error))
                        delay(app.timers.retryResubscribeDelay)
                        subscribe(request)
                    }
                    is SignalcError.MessagePipeNotCreated -> {
                        logger.error { "...error subscribing to messages for ${account.username}: ${error}." }
                        app.socketSender.send(SocketResponse.SubscriptionFailed(id, error))
                    }
                    else -> {
                        logger.error { "Subscription to ${account.username} unexpectedly cancelled: ${error.cause}." }
                        app.socketSender.send(SocketResponse.SubscriptionFailed(id, error))
                    }
                }
            }
        }
    }

    private suspend fun unsubscribe(request: SocketRequest.Unsubscribe) {
        val (id, username) = request
        app.accountManager.loadVerified(username) ?: return request.rejectUnverified()

        logger.info("Unsubscribing to messages for ${username}...")
        try {
            app.signalReceiver.unsubscribe(username)
            app.socketSender.send(SocketResponse.UnsubscribeSuccess(id, username))
            logger.info("...unsubscribed to messages for $username")
        } catch (err: Throwable) {
            app.socketSender.send(SocketResponse.UnsubscribeFailure(id, err))
            logger.error { "...error unsubscribing to messages for $username:\n${err.stackTraceToString()}" }
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
                    logger.debug { "Verify succeeded for ${account.username}" }
                } ?: run {
                    app.socketSender.send(SocketResponse.VerificationError.of(request, SignalcError.AuthorizationFailed))
                }
            }
        }
    } catch(error: Throwable) {
        app.socketSender.send(SocketResponse.VerificationError.of(request, error))
    }

    private suspend fun trust(request: SocketRequest.Trust) {
        val senderAccount: VerifiedAccount = app.accountManager.loadVerified(request.username)
            ?: return request.rejectUnverified()
        app.protocolStore.of(senderAccount).trustFingerprint(
            senderAccount.address.asSignalProtocolAddress(),
            // WARNING/NOTE: the below call works b/c signal encodes fingerprint with non-standard hex-encoding!
            // (Using spaces between each octet.) Don't try to use normal hex encoding/decoding or this will break!
            request.fingerprint.toByteArray(),
        )
        app.socketSender.send(SocketResponse.TrustSuccess.of(request))
    }

    // HELPERS
    private suspend fun SocketRequest.rejectUnverified(): Unit =
        when(this) {
            is SocketRequest.SetExpiration, is SocketRequest.Send, is SocketRequest.Trust ->
                SocketResponse.RequestHandlingError(id(), Error("Can't send to ${username()}: not registered."),this)
            is SocketRequest.Subscribe ->
                SocketResponse.SubscriptionFailed(id, SignalcError.SubscriptionOfUnregisteredUser)
            is SocketRequest.Unsubscribe ->
                SocketResponse.UnsubscribeFailure(id, SignalcError.UnsubscribeUnregisteredUser)
            else -> null
        }?.let { app.socketSender.send(it) }
            ?: Unit


}
