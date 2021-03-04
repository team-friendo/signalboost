package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.model.VerifiedAccount
import info.signalboost.signalc.util.TimeUtil
import kotlinx.coroutines.*
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalMessageSender(private val app: Application) {

    companion object {
        const val DEFAULT_EXPIRY_TIME = 60 * 60 * 24 // 1 day
        fun String.asAddress() = SignalServiceAddress(null, this)
        fun UUID.asAddress() = SignalServiceAddress(this, null)
    }

    private val messageSenders: ConcurrentHashMap<VerifiedAccount,SignalServiceMessageSender> =
        ConcurrentHashMap()

    private fun messageSenderOf(account: VerifiedAccount): SignalServiceMessageSender =
        // return a memoized message sender for this account
        messageSenders[account] ?:
        // or create a new one and memoize it
        SignalServiceMessageSender(
            app.signal.configs,
            account.credentialsProvider,
            app.protocolStore.of(account),
            app.signal.agent,
            true,
            false,
            absent(),
            absent(),
            absent(),
            null,
            Dispatchers.IO.asExecutor() as? ExecutorService,
        ).also { messageSenders[account]  = it }

    suspend fun send(
        sender: VerifiedAccount,
        recipient: SignalServiceAddress,
        body: String,
        timestamp: Long = TimeUtil.nowInMillis(),
        expiration: Int = DEFAULT_EXPIRY_TIME,
    ): SendMessageResult {
        val dataMessage =  SignalServiceDataMessage
            .newBuilder()
            .withBody(body)
            .withTimestamp(timestamp)
            .withExpiration(expiration)
            .build()
        // TODO: handle `signalservice.api.push.exceptions.NotFoundException` here
        return withContext(Dispatchers.IO) {
            messageSenderOf(sender).sendMessage(recipient, absent(), dataMessage)
        }
    }
}
