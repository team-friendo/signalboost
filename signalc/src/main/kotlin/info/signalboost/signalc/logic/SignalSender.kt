package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.dispatchers.Concurrency
import info.signalboost.signalc.metrics.Metrics
import info.signalboost.signalc.model.SignalcAddress
import info.signalboost.signalc.model.SignalcSendResult
import info.signalboost.signalc.model.SignalcSendResult.Companion.asSingalcSendResult
import info.signalboost.signalc.model.SocketRequest
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.util.CacheUtil.getMemoized
import info.signalboost.signalc.util.TimeUtil
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.async
import mu.KLoggable
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.crypto.UntrustedIdentityException
import org.whispersystems.signalservice.api.messages.SignalServiceAttachment
import org.whispersystems.signalservice.api.messages.SignalServiceAttachmentStream
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.nio.file.Files
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlin.io.path.ExperimentalPathApi
import kotlin.time.ExperimentalTime


@ExperimentalTime
@ExperimentalPathApi
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalSender(private val app: Application) {
    companion object: Any(), KLoggable {
        override val logger = logger()
        val metrics = Metrics.SignalSender
    }

    /********************
     * FIELDS/FACTORIES
     *******************/
    internal val messagesInFlight = AtomicInteger(0)
    private val messageSenders = ConcurrentHashMap<String,SignalServiceMessageSender>()

    private fun messageSenderOf(account: VerifiedAccount): SignalServiceMessageSender =
        getMemoized(messageSenders, account.username) {
            val store = app.protocolStore.of(account)
            SignalServiceMessageSender(
                app.signal.configs,
                account.credentialsProvider,
                store,
                store.lock,
                app.signal.agent,
                true,
                Optional.absent(), // pipe
                Optional.absent(), // unidentifiedPipe
                Optional.absent(), // eventListener
                null,
                Concurrency.Executor,
                -1L,
                true,
                Metrics.LibSignal
            )
        }

    // gross testing seam... sorry!
    object AttachmentStream {
        fun of(sendAttachment: SocketRequest.Send.Attachment, file: File, inputStream: InputStream): SignalServiceAttachmentStream =
            SignalServiceAttachmentStream(
                inputStream,
                sendAttachment.contentType,
                file.length(),
                Optional.of(file.name),
                sendAttachment.voiceNote,
                false, // borderless
                false, // gif
                Optional.absent(), // preview (we don't support those!)
                sendAttachment.width,
                sendAttachment.height,
                TimeUtil.nowInMillis(), //uploadTimestamp
                Optional.fromNullable(sendAttachment.caption),
                Optional.fromNullable(sendAttachment.blurHash),
                null, // progressListener
                null, // cancelationSignal
                Optional.absent(), // ResumableUploadSpec
            )
    }

    /**************
     * INTERFACE
     **************/

    suspend fun send(
        sender: VerifiedAccount,
        recipient: SignalcAddress,
        body: String,
        expiration: Int,
        attachments: List<SocketRequest.Send.Attachment> = emptyList(),
        timestamp: Long = TimeUtil.nowInMillis(),
    ): SignalcSendResult =
        // TODO: handle `signalservice.api.push.exceptions.NotFoundException` here
        sendDataMessage(
            sender,
            recipient,
            SignalServiceDataMessage
                .newBuilder()
                .withBody(body)
                .withTimestamp(timestamp)
                .withExpiration(expiration).let {
                    if(attachments.isEmpty()) it
                    else it.withAttachments(attachments.asSignalAttachments())
                }
                .withProfileKey(sender.profileKey.serialize())
                .build()
        )

    suspend fun setExpiration(
        sender: VerifiedAccount,
        recipient: SignalcAddress,
        expiresInSeconds: Int
    ): SignalcSendResult =
        sendDataMessage(
            sender,
            recipient,
            SignalServiceDataMessage
                .newBuilder()
                .asExpirationUpdate()
                .withExpiration(expiresInSeconds)
                .withProfileKey(sender.profileKey.serialize())
                .build()
        )

    suspend fun drain(): Triple<Boolean,Int,Int> = MessageQueue.drain(
        messagesInFlight,
        app.timers.drainTimeout,
        app.timers.drainPollInterval,
    )

    /***********
     * HELPERS
     ***********/


    private suspend fun sendDataMessage(
        sender: VerifiedAccount,
        recipient: SignalcAddress,
        dataMessage: SignalServiceDataMessage,
    ): SignalcSendResult = app.coroutineScope.async(Concurrency.Dispatcher) {
        // Try to send all messages sealed-sender by deriving `unidentifiedAccessPair`s from profile keys -- using e164 not UUUID
        // to retrieve profile key as we did when we stored it. Since messages without such tokens are always sent unsealed and
        // unsealed messages are rate limited by spam filters, we use a toggle to enable blocking all unsealed messages if needed.
        val unidentifiedAccessPair = app.accountManager.getUnidentifiedAccessPair(sender.id,recipient.id).also {
            metrics.numberOfUnsealedMessagesProduced.labels(sender.id).inc()
            if(it == null && app.toggles.blockUnsealedMessages) return@async SignalcSendResult.Blocked(recipient)
        }
        try {
            messagesInFlight.getAndIncrement()
            messageSenderOf(sender).sendMessage(
                recipient.asSignalServiceAddress(),
                Optional.fromNullable(unidentifiedAccessPair),
                dataMessage
            ).asSingalcSendResult()
        } catch (e: UntrustedIdentityException) {
            SignalcSendResult.IdentityFailure(recipient, e.identityKey)
        } finally {
            messagesInFlight.getAndDecrement()
            metrics.numberOfMessagesSent.inc()
            unidentifiedAccessPair ?: metrics.numberOfUnsealedMessagesSent.labels(sender.id).inc()
        }
    }.await()

    private fun List<SocketRequest.Send.Attachment>.asSignalAttachments(): List<SignalServiceAttachment> =
        this.mapNotNull { it.asSignalAttachment() }

    private fun SocketRequest.Send.Attachment.asSignalAttachment(): SignalServiceAttachmentStream? {
        return try {
            File(app.signal.attachmentsPath, this.filename).let {
                AttachmentStream.of(this, it, Files.newInputStream(it.toPath()))
            }
        } catch (e: IOException) {
            logger.error { "Failed to read attachment from file system:\n ${e.stackTraceToString()}"}
            null
        }
    }
}