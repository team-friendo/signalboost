package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.exception.SignalcCancellation
import info.signalboost.signalc.exception.SignalcError
import info.signalboost.signalc.model.EnvelopeType
import info.signalboost.signalc.model.EnvelopeType.Companion.asEnum
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.model.SocketResponse
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.util.CacheUtil.getMemoized
import info.signalboost.signalc.util.FileUtil.readToFile
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import mu.KLoggable
import org.postgresql.util.Base64
import org.signal.libsignal.metadata.ProtocolUntrustedIdentityException
import org.whispersystems.libsignal.UntrustedIdentityException
import org.whispersystems.signalservice.api.SignalServiceMessagePipe
import org.whispersystems.signalservice.api.SignalServiceMessageReceiver
import org.whispersystems.signalservice.api.crypto.SignalServiceCipher
import org.whispersystems.signalservice.api.messages.SignalServiceAttachment
import org.whispersystems.signalservice.api.messages.SignalServiceAttachmentPointer
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import java.io.File
import java.lang.Exception
import java.nio.file.Files
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
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
        private const val TIMEOUT = 1000L * 60 * 60 // 1 hr (copied from signald)
    }

    // FACTORIES

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
                null, // TODO: see [1] below
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
            SignalServiceCipher(
                account.address,
                app.protocolStore.of(account),
                app.signal.certificateValidator
            )
        }

    // LIFECYCLE / INTERFACE

    internal val subscriptionCount: Int
       get() = subscriptions.size

    internal val messagePipeCount: Int
        get() = messagePipes.size

    suspend fun subscribe(account: VerifiedAccount): Job? {
        // TODO(aguestuser|2021-01-21) handle: timeout, closed connection (understand `readyOrEmtpy()`?)
        if(subscriptions.containsKey(account.username)) return null // block attempts to re-subscribe to same account
        return app.coroutineScope.launch {
            val subscription = this

            // try to estabilish a message pipe with signal
            val messagePipe = try {
                messagePipeOf(account)
            } catch (e: Throwable) {
                logger.error { "Failed to create message pipe:\n ${e.stackTraceToString()}" }
                throw SignalcError.MessagePipeNotCreated(e)
            }

            // handle messages from the pipe...
            launch(IO) {
                // first, retry all envelopes previously cached but unhandled (due to interruption during handling)
                // (join on each retry job to prevent handling new message before cached ones are processed)
                app.envelopeStore.findAll(account.username).map { dispatch(account, it)?.join() }
                // handle new messages...
                while (subscription.isActive) {
                    // read (and cache) one envelope from the message pipe (we cache so we can retry if decryption fails)
                    val (envelope, cacheId) = receiveOnce(messagePipe, account)
                    // handle the envelope, decrypting and relaying if possible
                    dispatch(account, envelope)
                    // delete envelope cache, but don't wait for deletion to complete before handling next message
                    cacheId?.let {
                        launch(IO) { app.envelopeStore.delete(it) }
                    }
                }
            }
        }.also {
            // cache the subscription to aid in cleanup later
            subscriptions[account.username] = it
        }
    }

    suspend fun unsubscribe(account: VerifiedAccount) = app.coroutineScope.async(IO) {
        try {
            messagePipes[account.username]?.shutdown()
            subscriptions[account.username]?.cancel(SignalcCancellation.SubscriptionCancelled)
        } finally {
            listOf(subscriptions, messageReceivers, messagePipes, ciphers).forEach {
                it.remove(account.username)
            }
        }
    }.await()

    // HELPERS

    private fun receiveOnce(messagePipe: SignalServiceMessagePipe, account: VerifiedAccount): Pair<SignalServiceEnvelope,UUID?> {
        var cacheId: UUID? = null
        val envelope = messagePipe.read(TIMEOUT, TimeUnit.MILLISECONDS) {
            // cache new envelopes before acknowledging receipt to server or decrypting (see docs for #read)
            cacheId = try {
                app.envelopeStore.create(account.username, it)
            } catch (err: Throwable) {
                // don't propagate error b/c we don't want to disrupt the message-listening loop!
                logger.error { "Failed to cache envelope for ${account.username}:\n${err.stackTraceToString()}" }
                null
            }
        }
        return Pair(envelope, cacheId)
    }

    private suspend fun dispatch(account: VerifiedAccount, envelope: SignalServiceEnvelope): Job?  {
        logger.debug { "Got ${envelope.type.asEnum()} from ${envelope.sourceAddress.number} to ${account.username}" }
        return when (envelope.type.asEnum()) {
            EnvelopeType.CIPHERTEXT,
            EnvelopeType.PREKEY_BUNDLE -> {
                handleCiphertext(envelope, account)
            }
            // TODO(aguestuser|2021-03-04): handle any of these?
            EnvelopeType.KEY_EXCHANGE,
            EnvelopeType.RECEIPT,
            EnvelopeType.UNIDENTIFIED_SENDER,
            EnvelopeType.UNKNOWN -> {
                app.socketSender.send(
                    SocketResponse.Dropped(envelope.asSignalcAddress(), account.asSignalcAddress(), envelope)
                )
                null
            }
        }
    }


    private suspend fun handleCiphertext(envelope: SignalServiceEnvelope, account: VerifiedAccount): Job {
        // Attempt to decrypt envelope in a new coroutine then relay result to socket message sender for handling.
        val (sender, recipient) = Pair(envelope.asSignalcAddress(), account.asSignalcAddress())
        return app.coroutineScope.launch(IO) {
            try {
                val dataMessage: SignalServiceDataMessage = cipherOf(account).decrypt(envelope).dataMessage.orNull()
                    ?: return@launch // drop other message types (eg: typing message, sync message, etc)
                val body = dataMessage.body?.orNull() ?: ""
                val attachments = dataMessage.attachments.orNull() ?: emptyList()

                app.socketSender.send(
                    SocketResponse.Cleartext.of(
                        sender,
                        recipient,
                        body, // we allow empty message bodies b/c that's how expiry timer changes are sent
                        attachments.mapNotNull { it.retrieveFor(account) },
                        dataMessage.expiresInSeconds,
                        dataMessage.timestamp,
                    )
                )
            } catch(e: Exception) {
                when(e) {
                    is ProtocolUntrustedIdentityException -> {
                        // untrustedIdentity is usually null on the exception here, need to trigger send to reset session
                        // see libsignal intialization of exception: https://github.com/signalapp/libsignal-client/blob/113e849d7620c7a0ad8aa29a43e6243026bfdb89/rust/bridge/shared/src/jni/mod.rs#L106
                        // see signal-android handling: https://github.com/signalapp/Signal-Android/blob/763aeabdddcbeff526589afa964d61defdd3e589/app/src/main/java/org/thoughtcrime/securesms/messages/MessageDecryptionUtil.java#L82
                        val untrustedIdentityException = e.cause as UntrustedIdentityException
                        val fingerprint = untrustedIdentityException.untrustedIdentity?.fingerprint

                        app.socketSender.send(
                            SocketResponse.InboundIdentityFailure.of(
                                recipient,
                                sender,
                                fingerprint
                            )
                        )
                    } else -> {
                        app.socketSender.send(SocketResponse.DecryptionError(sender, recipient, e))
                        logger.error { "Decryption Error:\n ${e.stackTraceToString()}" }
                    }
                }
            }
        }
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
 * TODO: signald (and thus we) leave ConnectivityListener unimplemented.
 *  We likely should not follow suit. Here is what a ConnectivityListener does:
 *
 *  public interface ConnectivityListener {
 *    void onConnected();
 *    void onConnecting();
 *    void onDisconnected();
 *    void onAuthenticationFailure();
 * }
 *
 **/
