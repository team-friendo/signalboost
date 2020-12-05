package info.signalboost.signalc.logic


import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.time.Instant

object Messaging {

    private const val DEFAULT_EXPIRY_TIME = 60 * 60 * 24 // 1 day

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