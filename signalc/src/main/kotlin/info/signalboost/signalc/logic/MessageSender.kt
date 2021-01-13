package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.model.VerifiedAccount
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress

class MessageSender(app: Application, account: VerifiedAccount) {
    companion object {
        private const val DEFAULT_EXPIRY_TIME = 60 * 60 * 24 // 1 day
    }

    private val sender  by lazy {
        SignalServiceMessageSender(
            app.signal.configs,
            account.credentialsProvider,
            app.store.signalProtocol.of(account),
            app.signal.agent,
            true,
            false,
            absent(),
            absent(),
            absent(),
            null,
            null,
        )
    }

    fun send(
        messageBody: String,
        recipientPhone: String,
        timestamp: Long = TimeUtil.nowInMillis(),
        expiration: Int = DEFAULT_EXPIRY_TIME,
    ): SendMessageResult {
        val recipientAddress = SignalServiceAddress(null, recipientPhone)
        val dataMessage =  SignalServiceDataMessage
            .newBuilder()
            .withBody(messageBody)
            .withTimestamp(timestamp)
            .withExpiration(expiration)
            .build()
        return sender.sendMessage(recipientAddress, absent(), dataMessage)
    }
}
