package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.dispatchers.Concurrency
import info.signalboost.signalc.exception.SignalcCancellation
import info.signalboost.signalc.exception.SignalcError
import info.signalboost.signalc.metrics.Metrics
import info.signalboost.signalc.model.EnvelopeType
import info.signalboost.signalc.model.EnvelopeType.Companion.asEnum
import info.signalboost.signalc.model.SignalcAddress
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.model.SocketResponse
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.util.CacheUtil.getMemoized
import info.signalboost.signalc.util.FileUtil.readToFile
import kotlinx.coroutines.*
import mu.KLoggable
import org.postgresql.util.Base64
import org.signal.libsignal.metadata.ProtocolUntrustedIdentityException
import org.whispersystems.signalservice.api.SignalServiceMessagePipe
import org.whispersystems.signalservice.api.SignalServiceMessageReceiver
import org.whispersystems.signalservice.api.crypto.SignalServiceCipher
import org.whispersystems.signalservice.api.messages.SignalServiceAttachment
import org.whispersystems.signalservice.api.messages.SignalServiceAttachmentPointer
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.util.*
import java.util.concurrent.CancellationException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicInteger
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime


@ExperimentalTime
@ExperimentalPathApi
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalReceiver(private val app: Application) {
    companion object: Any(), KLoggable {
        override val logger = logger()
        private const val TMP_FILE_PREFIX = "___"
        private const val TMP_FILE_SUFFIX = ".tmp"
        private const val MAX_ATTACHMENT_SIZE = 150L * 1024 * 1024 // 150MB
    }

    // INNER CLASS(ES)

    enum class SubscribeErrorContinuation {
        CONTINUE,
        RETURN,
        RETURN_AND_CANCEL;
    }

    // FIELDS/FACTORIES

    internal val messagesInFlight = AtomicInteger(0)

    private val subscriptions = ConcurrentHashMap<String,Job>()
    private val messageReceivers = ConcurrentHashMap<String,SignalServiceMessageReceiver>()
    private val messagePipes = ConcurrentHashMap<String,SignalServiceMessagePipe>()
    private val ciphers = ConcurrentHashMap<String,SignalServiceCipher>()

    private fun messageReceiverOf(account: VerifiedAccount): SignalServiceMessageReceiver =
        getMemoized(messageReceivers, account.username) {
            SignalServiceMessageReceiver(
                app.signal.configs,
                account.credentialsProvider,
                app.signal.agent,
                null, // ConnectivityListender (left unimplemented) see [1] below
                UptimeSleepTimer(),
                app.signal.clientZkOperations?.profileOperations,
                true
            )
        }

    private fun messagePipeOf(account: VerifiedAccount): SignalServiceMessagePipe =
        getMemoized(messagePipes, account.username) {
            messageReceiverOf(account).createMessagePipe()
        }

    private fun cipherOf(account: VerifiedAccount): SignalServiceCipher =
        getMemoized(ciphers, account.username) {
            val store = app.protocolStore.of(account)
            SignalServiceCipher(
                account.address.asSignalServiceAddress(),
                store,
                store.lock,
                app.signal.certificateValidator
            )
        }

    // LIFECYCLE / INTERFACE

    internal val subscriptionCount: Int
       get() = subscriptions.size

    internal val messagePipeCount: Int
        get() = messagePipes.size

    suspend fun drain(): Triple<Boolean,Int,Int> = MessageQueue.drain(
        messagesInFlight,
        app.timers.drainTimeout,
        app.timers.drainPollInterval,
    )

    suspend fun subscribe(account: VerifiedAccount): Job? {
        if(subscriptions.containsKey(account.username)) return null // block attempts to re-subscribe to same account
        return app.coroutineScope.launch sub@ {
            val subscription = this

            // try to estabilish a message pipe with signal
            val messagePipe = try {
                messagePipeOf(account)
            } catch (e: Throwable) {
                logger.error { "Failed to create message pipe:\n ${e.stackTraceToString()}" }
                throw SignalcError.MessagePipeNotCreated(e)
            }

            // handle messages from the pipe...
            launch(Concurrency.Dispatcher) {
                while (subscription.isActive) {
                    val envelope = try {
                        messagePipe.read(
                            app.timers.readTimeout.toLong(TimeUnit.MILLISECONDS),
                            TimeUnit.MILLISECONDS
                        )
                    } catch(err: Throwable) {
                        when(handleSubscribeError(err, account)) {
                            SubscribeErrorContinuation.CONTINUE -> continue
                            SubscribeErrorContinuation.RETURN -> return@launch
                            SubscribeErrorContinuation.RETURN_AND_CANCEL -> return@launch subscription.cancel()
                        }
                    }
                    dispatch(account, envelope)
                }
            }
        }.also {
            // cache the subscription to aid in cleanup later
            subscriptions[account.username] = it
        }
    }


    suspend fun unsubscribe(accountId: String, error: CancellationException = SignalcCancellation.SubscriptionCancelledByClient) =
        app.coroutineScope.async(Concurrency.Dispatcher) {
            try {
                messagePipes[accountId]?.shutdown()
                subscriptions[accountId]?.cancel(error)
            } finally {
                listOf(subscriptions, messageReceivers, messagePipes, ciphers).forEach {
                    it.remove(accountId)
                }
            }
        }.await()

    suspend fun unsubscribeAll() = subscriptions.keys.map { unsubscribe(it) }

    // HELPERS

    private suspend fun dispatch(account: VerifiedAccount, envelope: SignalServiceEnvelope): Job?  {
        envelope.type.asEnum().let {
            logger.debug { "Got ${it.asString} from ${envelope.sourceIdentifier ?: "SEALED"} to ${account.username}" }
            Metrics.SignalReceiver.numberOfMessagesReceived.labels(it.asString).inc()
            return when (it) {
                EnvelopeType.CIPHERTEXT,
                EnvelopeType.UNIDENTIFIED_SENDER -> processMessage(envelope, account)

                EnvelopeType.PREKEY_BUNDLE -> {
                    processPreKeyBundle(envelope, account)
                    processMessage(envelope, account)
                }

                EnvelopeType.RECEIPT -> processReceipt(envelope, account)

                EnvelopeType.KEY_EXCHANGE, // TODO: handle this to process "reset secure session" events
                EnvelopeType.UNKNOWN -> drop(envelope, account)
            }
        }
    }

    private suspend fun processMessage(envelope: SignalServiceEnvelope, account: VerifiedAccount): Job {
        // Attempt to decrypt envelope in a new coroutine then relay result to socket message sender for handling.
        return app.coroutineScope.launch(Concurrency.Dispatcher) {
            var contactAddress: SignalcAddress? = null // not available until after decryption for sealed-sender msgs
            try {
                messagesInFlight.getAndIncrement()
                val contents = cipherOf(account).decrypt(envelope)
                val dataMessage = contents.dataMessage.orNull()
                    ?: return@launch // drop other message types (eg: typing message, sync message, etc)

                contactAddress = contents.sender.asSignalcAddress()
                val body = dataMessage.body?.orNull() ?: ""
                val attachments = dataMessage.attachments.orNull() ?: emptyList()

                if(dataMessage.isProfileKeyUpdate) {
                    // TODO: metrics instead of loglines below?
                    dataMessage.profileKey.orNull()
                        ?.let {
                            logger.debug { "Storing profile key for ${contactAddress.identifier}}" }
                            app.contactStore.storeProfileKey(account.id, contactAddress.identifier, it)
                        }
                        ?: logger.error { "Received profile key update with no key for ${contactAddress.identifier}!" }
                }

                app.socketSender.send(
                    SocketResponse.Cleartext.of(
                        contactAddress,
                        account.address,
                        body, // we allow empty message bodies b/c that's how expiry timer changes are sent
                        attachments.mapNotNull { it.retrieveFor(account) },
                        dataMessage.expiresInSeconds,
                        dataMessage.timestamp,
                    )
                )
            } catch(err: Throwable) {
                // TODO: we don't always have a contactAddress here anymore... wat do?
                handleRelayError(err, account.address, contactAddress)
            } finally {
                messagesInFlight.getAndDecrement()
            }
        }
    }

    private suspend fun processReceipt(envelope: SignalServiceEnvelope, account: VerifiedAccount): Job? {
        if(!envelope.isUnidentifiedSender) {
            app.contactStore.storeUuidOrPhoneNumber(
                accountId = account.username,
                contactPhoneNumber =  envelope.sourceE164.get(),
                contactUuid =  UUID.fromString(envelope.sourceUuid.get()),
            )
        }
        return null
    }

    private suspend fun processPreKeyBundle(envelope: SignalServiceEnvelope, account: VerifiedAccount) =
        withContext(app.coroutineScope.coroutineContext + Concurrency.Dispatcher) {
            logger.info { "phoneNumber = ${envelope.sourceE164.get()}, uuid = ${envelope.sourceUuid.get()}" }
            app.contactStore.resolveContactIdSuspend(account.username, envelope.sourceIdentifier) ?: run {
                app.contactStore.create(
                    accountId = account.username,
                    phoneNumber = envelope.sourceE164.get(),
                    uuid = UUID.fromString(envelope.sourceUuid.get()),
                )
                // we don't think this actually does anything meaningful... might restore!
                 app.signalSender.sendProfileKey(account, envelope.asSignalcAddress())
            }
            // If we are receiving a prekey bundle, this is the beginning of a new session, the initiation
            // of which might have depleted our prekey reserves below the level we want to keep on hand
            // to start new sessions. So: launch a background job to check our prekey reserve and replenish it if needed!
            app.accountManager.refreshPreKeysIfDepleted(account)
        }

    private suspend fun drop(envelope: SignalServiceEnvelope, account: VerifiedAccount): Job? {
        app.socketSender.send(
            SocketResponse.Dropped(envelope.asSignalcAddress(), account.address, envelope)
        )
        return null
    }

    private suspend fun handleRelayError(err: Throwable, account: SignalcAddress, contact: SignalcAddress?) {
        when (err) {
            is ProtocolUntrustedIdentityException -> {
                // When we get this exception we return a null fingerprint to the client, with the intention of causing
                // it to send a garbage message that will force a session reset and raise another identity exception.
                // That exception (unlike this one) will include the fingerprint corresponding to the new session,
                // and can be handled (and trusted) from the send path.
                app.socketSender.send(
                    SocketResponse.InboundIdentityFailure.of(
                        account,
                        contact,
                        null,
                    )
                )
            }
            else -> {
                app.socketSender.send(SocketResponse.DecryptionError(account, contact, err))
                logger.error { "Decryption Error:\n ${err.stackTraceToString()}" }
            }
        }
    }

    private suspend fun handleSubscribeError(e: Throwable, account: VerifiedAccount): SubscribeErrorContinuation =
        when (e) {
            // on timeout, setup message pipe again, as we want to keep reading
            is TimeoutException -> SubscribeErrorContinuation.CONTINUE
            is IOException -> run {
                if (app.isShuttingDown) {
                    // on io error caused by client shutdown, cancel job and stop reading from signal
                    logger.warn { "Connection closed on websocket for ${account.username}, cancelling subscription..." }
                    SubscribeErrorContinuation.RETURN_AND_CANCEL
                } else {
                    // on io error caused by disrupted connection to server, unsubscribe so that we can resubscribe
                    logger.warn { "Connection error on websocket for ${account.username}, unsubscribing..." }
                    unsubscribe(account.username, SignalcCancellation.SubscriptionDisrupted(e))
                    SubscribeErrorContinuation.RETURN
                }
            }
            else -> throw e // this will be handled as a disrupted subscription in `SocketReceiver`
        }

    private fun SignalServiceAttachment.retrieveFor(account: VerifiedAccount): SocketResponse.Cleartext.Attachment? {
        val pointer: SignalServiceAttachmentPointer = this.asPointer() ?: return null

        val outputFile = File(app.signal.attachmentsPath, pointer.remoteId.toString())
        val tmpFile: File = File.createTempFile(TMP_FILE_PREFIX, TMP_FILE_SUFFIX)
        val inputStream = messageReceiverOf(account).retrieveAttachment(pointer,tmpFile,MAX_ATTACHMENT_SIZE)

        return readToFile(inputStream, outputFile)?.let { file ->
            SocketResponse.Cleartext.Attachment(
                blurHash = pointer.blurHash.orNull(),
                caption = pointer.caption.orNull(),
                contentType = pointer.contentType,
                digest = pointer.digest.orNull()?.let { Base64.encodeBytes(it) },
                filename = file.name,
                height = pointer.height,
                id = pointer.remoteId.toString(),
                key = Base64.encodeBytes(pointer.key),
                size = pointer.size.orNull(),
                width = pointer.width,
                voiceNote = pointer.voiceNote,
            )
        }.also {
            Files.deleteIfExists(tmpFile.toPath())
        }
    }
}

/*[1]**********
 * Here is what a ConnectivityListener does:
 *
 *  public interface ConnectivityListener {
 *    void onConnected();
 *    void onConnecting();
 *    void onDisconnected();
 *    void onAuthenticationFailure();
 * }
 *
 **/
