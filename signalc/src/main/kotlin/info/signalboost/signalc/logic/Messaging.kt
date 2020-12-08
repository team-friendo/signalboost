package info.signalboost.signalc.logic


import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.time.Instant

object Messaging {

    const val DEFAULT_EXPIRY_TIME = 60 * 60 * 24 // 1 day

    fun sendMessage(
        messageSender: SignalServiceMessageSender,
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
        return messageSender.sendMessage(recipientAddress, absent(), dataMessage)
    }
}