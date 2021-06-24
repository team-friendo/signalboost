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
import org.signal.libsignal.metadata.ProtocolException
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
        private val metrics = Metrics.SignalReceiver
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
            metrics.numberOfMessagesReceived.labels(it.asString).inc()
            return when (it) {
                EnvelopeType.CIPHERTEXT,
                EnvelopeType.UNIDENTIFIED_SENDER -> {
                    processMessage(envelope, account)
                }
                EnvelopeType.PREKEY_BUNDLE -> {
                    processPreKeyBundle(envelope, account)
                    processMessage(envelope, account)
                }
                EnvelopeType.RECEIPT -> {
                    processReceipt(envelope, account)
                    null
                }
                EnvelopeType.KEY_EXCHANGE, // TODO: handle KEY_EXCHANGE to process "reset secure session" events
                EnvelopeType.UNKNOWN ->  {
                    drop(envelope, account)
                    null
                }
            }
        }
    }

    /**
     * Attempt to decrypt envelope and process data message then relay result to socket for handling by client.
     */
    private suspend fun processMessage(envelope: SignalServiceEnvelope, account: VerifiedAccount): Job {
        return app.coroutineScope.launch(Concurrency.Dispatcher) {
            var contactAddress: SignalcAddress? = null // not available until after decryption for sealed-sender msgs
            try {
                messagesInFlight.getAndIncrement()

                // decrypt data message (returning early if not data message -- eg: typing notification, etc.)
                val contents = cipherOf(account).decrypt(envelope)
                val dataMessage = contents.dataMessage.orNull()?: return@launch
                contactAddress = contents.sender.asSignalcAddress()

                // store sender's profile key if present and acknowledge message receipt to them
                dataMessage.profileKey.orNull()?.let {
                    app.contactStore.storeProfileKey(account.id, contactAddress.identifier, it)
                } ?: run {
                    metrics.numberOfMessagesWithoutProfileKey.labels(envelope.isUnidentifiedSender.toString()).inc()
                }
                launch {
                    app.signalSender.sendReceipt(account, contactAddress, dataMessage.timestamp)
                }

                // extract contents of message and relay to client
                val body = dataMessage.body?.orNull() ?: "" // expiry timer changes contain empty message bodies
                val attachments = dataMessage.attachments.orNull() ?: emptyList()
                app.socketSender.send(
                    SocketResponse.Cleartext.of(
                        contactAddress,
                        account.address,
                        body,
                        attachments.mapNotNull { it.retrieveFor(account) },
                        dataMessage.expiresInSeconds,
                        dataMessage.timestamp,
                    )
                )
            } catch(err: Throwable) {
                handleRelayError(err, account.address, contactAddress)
            } finally {
                messagesInFlight.getAndDecrement()
            }
        }
    }

    private suspend fun processPreKeyBundle(envelope: SignalServiceEnvelope, account: VerifiedAccount) {
        // Prekey buncles are received (once per device) from new contacts before we initiate a sealed sender session
        // with them. As such, this is our first (and only!) chance to store both the UUID and phone number
        // that will be necessary to successfully decrypt subsequent messages in a session that may refer to the same
        // user by *either* UUID or phone number (and will switch between the two during thes same session).
        // We store both here so we can resolve either UUID or phone number to the same contact later.
        // We also want new contacts to be able to send us sealed sender messages as soon as possible, so
        // we send them our profile key, which enables sealed-sender message sending.
        if(!app.contactStore.hasContact(account.id, envelope.sourceIdentifier)) {
            app.contactStore.create(account, envelope)
            app.signalSender.sendProfileKey(account, envelope.asSignalcAddress())
        }
        // If we are receiving a prekey bundle, this is also the beginning of a new session, which consumes one of the
        // recipient's one-time prekeys. Since this might have depleted the recipient's prekeys below the number needed
        // to start new sessions, we launch a background job to check the prekey reserve and replenish it if needed!
        app.accountManager.refreshPreKeysIfDepleted(account)
    }

    private suspend fun processReceipt(envelope: SignalServiceEnvelope, account: VerifiedAccount) =
        // An unsealed receipt is the first contact we will have if we initiated a conversation with a contact, so
        // use the opportunity to store their UUID and phone number! (Note: all envelopes of type RECEIPT are unsealed.)
        app.contactStore.storeMissingIdentifier(
            accountId = account.id,
            contactPhoneNumber =  envelope.sourceE164.get(),
            contactUuid =  UUID.fromString(envelope.sourceUuid.get()),
        )


    private suspend fun drop(envelope: SignalServiceEnvelope, account: VerifiedAccount) =
        app.socketSender.send(
            SocketResponse.Dropped(envelope.asSignalcAddress(), account.address, envelope)
        )

    private suspend fun handleRelayError(err: Throwable, account: SignalcAddress, decryptedContact: SignalcAddress?) {
        when (err) {
            is ProtocolUntrustedIdentityException -> {
                // When we get this exception we return a null fingerprint to the client, with the intention of causing
                // it to send a garbage message that will force a session reset and raise another identity exception.
                // That exception (unlike this one) will include the fingerprint corresponding to the new session,
                // and can be handled (and trusted) from the send path.
                val contactAddress = app.contactStore.getContactAddress(account.id, err.sender)
                app.socketSender.send(SocketResponse.InboundIdentityFailure.of(account, contactAddress,null))
            }
            is ProtocolException -> {
                val contactAddress = app.contactStore.getContactAddress(account.id, err.sender)
                app.socketSender.send(SocketResponse.DecryptionError(account, contactAddress, err))
                logger.error { "Decryption Error:\n ${err.stackTraceToString()}" }
            }
            else -> {
                app.socketSender.send(SocketResponse.MessageHandlingError(account, decryptedContact, err))
                logger.error { "Error handling incoming message from signal:\n ${err.stackTraceToString()}" }
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
