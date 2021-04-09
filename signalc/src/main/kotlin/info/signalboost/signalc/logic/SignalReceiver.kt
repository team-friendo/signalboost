package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.error.SignalcError
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
import kotlin.io.path.deleteIfExists


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

    private val messageReceivers = ConcurrentHashMap<String,SignalServiceMessageReceiver>()
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

    fun messagePipeOf(account: VerifiedAccount): SignalServiceMessagePipe =
        messageReceiverOf(account).createMessagePipe()

    private fun cipherOf(account: VerifiedAccount): SignalServiceCipher =
        getMemoized(ciphers, account.username) {
            SignalServiceCipher(
                account.address,
                app.protocolStore.of(account),
                app.signal.certificateValidator
            )
        }

    // MESSAGE LISTENING

    suspend fun subscribe(account: VerifiedAccount): Job {
        // TODO(aguestuser|2021-01-21):
        //  make this resilient to duplicate subscriptions by:
        //  - keeping hashmap of messagePipes
        //  - if caller tries to create a message pipe for an account that already has one, return null
        //  -> caller only gets a receive channel if one doesn't already exist somewhere else
        //  -> we can leverage the hashmap for unsubscribing
        //  handle:
        //  - timeout
        //  - closed connection (understand `readyOrEmtpy()`?)
        //  - closed channel
        //  - random runtime error
        //  - cleanup message pipe on unsubscribe (by calling messagePipe.shutdown())
        // TODO: custom error for messagePipeCreation
        return app.coroutineScope.launch {
            //TODO: why does launching this in IO Dispatcher cause tests to faiL?
            val outerScope = this
            val messagePipe = try {
                messagePipeOf(account)
            } catch (e: Throwable) {
                logger.error { "Failed to create message pipe:\n ${e.stackTraceToString()}" }
                throw SignalcError.MessagePipeNotCreated(e)
            }
            launch(IO) {
                while (outerScope.isActive) {
                    val envelope = messagePipe.read(TIMEOUT, TimeUnit.MILLISECONDS)
                    logger.debug {
                        "Got ${envelope.type.asEnum()} message from ${envelope.sourceAddress.number} to ${account.username}"
                    }
                    dispatch(account, envelope)
                }
            }
        }
    }

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
