package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.model.SocketRequest
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.util.CacheUtil.getMemoized
import info.signalboost.signalc.util.TimeUtil
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import mu.KLoggable
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceAttachment
import org.whispersystems.signalservice.api.messages.SignalServiceAttachmentStream
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.nio.file.Files
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import kotlin.io.path.ExperimentalPathApi


@ExperimentalPathApi
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalSender(private val app: Application) {
    companion object: KLoggable {
        override val logger = logger()
        fun String.asAddress() = SignalServiceAddress(null, this)
        fun UUID.asAddress() = SignalServiceAddress(this, null)
    }

    /**************
     * FACTORIES
     **************/

    private val messageSenders = ConcurrentHashMap<String,SignalServiceMessageSender>()

    private fun messageSenderOf(account: VerifiedAccount): SignalServiceMessageSender =
        getMemoized(messageSenders, account.username) {
            SignalServiceMessageSender(
                app.signal.configs,
                account.credentialsProvider,
                app.protocolStore.of(account),
                app.signal.agent,
                true,
                Optional.absent(), // pipe
                Optional.absent(), // unidentifiedPipe
                Optional.absent(), // eventListener
                null,
                IO.asExecutor() as? ExecutorService,
                -1L,
                true,
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
                Optional.absent(), // preview (we don't support those!)
                sendAttachment.width,
                sendAttachment.height,
                TimeUtil.nowInMillis(),
                Optional.fromNullable(sendAttachment.caption),
                Optional.fromNullable(sendAttachment.blurHash),
                null, // listener
                null, // cancelationSignal
                Optional.absent() // ResumableUploadSpec
            )
    }

    /**************
     * INTERFACE
     **************/

    suspend fun send(
        sender: VerifiedAccount,
        recipient: SignalServiceAddress,
        body: String,
        expiration: Int,
        attachments: List<SocketRequest.Send.Attachment> = emptyList(),
        timestamp: Long = TimeUtil.nowInMillis(),
    ): SendMessageResult =
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
                .build()
        )

    suspend fun setExpiration(
        sender: VerifiedAccount,
        recipient: SignalServiceAddress,
        expiresInSeconds: Int
    ): SendMessageResult =
        sendDataMessage(
            sender,
            recipient,
            SignalServiceDataMessage
                .newBuilder()
                .asExpirationUpdate()
                .withExpiration(expiresInSeconds)
                .build()
        )

    /***********
     * HELPERS
     ***********/

    private suspend fun sendDataMessage(
        sender: VerifiedAccount,
        recipient: SignalServiceAddress,
        dataMessage: SignalServiceDataMessage,
    ): SendMessageResult = app.coroutineScope.async(IO) {
        messageSenderOf(sender).sendMessage(
            recipient,
            Optional.absent(),
            dataMessage
        )
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