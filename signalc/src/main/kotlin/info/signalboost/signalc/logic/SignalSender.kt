package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.util.CacheUtil.getMemoized
import info.signalboost.signalc.util.TimeUtil
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService

@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalSender(private val app: Application) {
    companion object {
        fun String.asAddress() = SignalServiceAddress(null, this)
        fun UUID.asAddress() = SignalServiceAddress(this, null)
    }


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


    suspend fun send(
        sender: VerifiedAccount,
        recipient: SignalServiceAddress,
        body: String,
        expiration: Int,
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
                .withExpiration(expiration)
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


    // helper
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
}