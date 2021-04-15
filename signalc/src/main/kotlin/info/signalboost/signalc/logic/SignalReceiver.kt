package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.exception.SignalcCancellation
import info.signalboost.signalc.exception.SignalcError
import info.signalboost.signalc.model.*
import info.signalboost.signalc.model.EnvelopeType.Companion.asEnum
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import info.signalboost.signalc.util.CacheUtil.getMemoized
import info.signalboost.signalc.util.FileUtil.readToFile
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import mu.KLoggable
import org.postgresql.util.Base64
import org.whispersystems.signalservice.api.SignalServiceMessagePipe
import org.whispersystems.signalservice.api.SignalServiceMessageReceiver
import org.whispersystems.signalservice.api.crypto.SignalServiceCipher
import org.whispersystems.signalservice.api.messages.SignalServiceAttachment
import org.whispersystems.signalservice.api.messages.SignalServiceAttachmentPointer
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import java.io.*
import java.nio.file.Files
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.io.path.ExperimentalPathApi


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
        // TODO(aguestuser|2021-01-21) handle:
        //  - timeout
        //  - closed connection (understand `readyOrEmtpy()`?)
        //  - random runtime error
        if(subscriptions.containsKey(account.username)) return null // block attempts to re-subscribe to same account
        return app.coroutineScope.launch {
            val subscription = this
            val messagePipe = try {
                messagePipeOf(account)
            } catch (e: Throwable) {
                logger.error { "Failed to create message pipe:\n ${e.stackTraceToString()}" }
                throw SignalcError.MessagePipeNotCreated(e)
            }
            launch(IO) {
                while (subscription.isActive) {
                    val envelope = messagePipe.read(TIMEOUT, TimeUnit.MILLISECONDS)
                    logger.debug {
                        "Got ${envelope.type.asEnum()} message from ${envelope.sourceAddress.number} to ${account.username}"
                    }
                    dispatch(account, envelope)
                }
            }
        }.also {
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

    // MESSAGE HANDLING

    private suspend fun dispatch(account: VerifiedAccount, envelope: SignalServiceEnvelope) {
        when(envelope.type.asEnum()) {
            EnvelopeType.CIPHERTEXT,
            EnvelopeType.PREKEY_BUNDLE -> handleCiphertext(envelope, account)
            // TODO(aguestuser|2021-03-04): handle any of these?
            EnvelopeType.KEY_EXCHANGE,
            EnvelopeType.RECEIPT,
            EnvelopeType.UNIDENTIFIED_SENDER,
            EnvelopeType.UNKNOWN -> drop(envelope, account)
        }
    }

    private suspend fun handleCiphertext(envelope: SignalServiceEnvelope, account: VerifiedAccount){
        // Attempt to decrypt envelope in a new coroutine then relay result to socket message sender for handling.
        val (sender, recipient) = Pair(envelope.asSignalcAddress(), account.asSignalcAddress())
        app.coroutineScope.launch(IO) {
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

            } catch(e: Throwable) {
                app.socketSender.send(SocketResponse.DecryptionError(sender, recipient, e))
                logger.error { "Decryption Error:\n ${e.stackTraceToString()}" }
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


    private suspend fun drop(envelope: SignalServiceEnvelope, account: VerifiedAccount) {
        app.socketSender.send(
            SocketResponse.Dropped(envelope.asSignalcAddress(), account.asSignalcAddress(), envelope)
        )
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
