package info.signalboost.signalc.logic


import info.signalboost.signalc.Config.SIGNAL_AGENT
import info.signalboost.signalc.Config.signalServiceConfig
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.model.RegisteredAccount
import org.whispersystems.libsignal.state.SignalProtocolStore
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.time.Instant

object Messaging {

    private const val DEFAULT_EXPIRY_TIME = 60 * 60 * 24 // 1 day

    fun messageSenderOf(account: RegisteredAccount, store: SignalProtocolStore) = SignalServiceMessageSender(
        signalServiceConfig,
        account.asCredentialsProvider,
        store,
        SIGNAL_AGENT,
        true,
        false,
        absent(),
        absent(),
        absent(),
        null,
        null,
    )

    fun sendMessage(messageSender: SignalServiceMessageSender, messageBody: String, recipientPhone: String, expiration: Int = DEFAULT_EXPIRY_TIME): SendMessageResult {
        val timestamp = Instant.now().toEpochMilli()
        val recipientAddress = SignalServiceAddress(null, recipientPhone)
        val dataMessage =  SignalServiceDataMessage
            .newBuilder()
            .withTimestamp(timestamp)
            .withBody(messageBody)
            .withExpiration(expiration)
            .build()
        return messageSender.sendMessage(recipientAddress, absent(), dataMessage)
    }
}