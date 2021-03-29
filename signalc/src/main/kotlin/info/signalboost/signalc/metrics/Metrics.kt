package info.signalboost.signalc.metrics

import io.prometheus.client.Counter
import io.prometheus.client.Histogram
import org.whispersystems.signalservice.api.LibSignalMetrics

object Metrics {
    private fun registerHistogram(name: String, help: String): Histogram =
        Histogram.build().name(name).help(help).register()

    private fun registerCounter(name: String, help: String): Counter =
        Counter.build().name(name).help(help).register()

    object AccountManager {
        val timeToLoadVerifiedAccount =
            registerHistogram(
                "account_manager__time_to_load_verified_account",
                "Time spent in AccountManger.loadVerified"
            )
    }

    object LibSignal: LibSignalMetrics {
        private val timeSendingMessageOverNetworkHistogram =  registerHistogram(
            "libsignal__time_sending_message_over_network",
            "Time spent in SignalServiceMessageSender.sendMessage sending message over network"
        )
        override fun getTimeSendingMessageOverNetwork() = timeSendingMessageOverNetworkHistogram

        private val timeSpentInGetEncryptedMessagesHistogram = registerHistogram(
            "libsignal__time_getting_encrypted_messages",
            "Time spent in SignalServiceMessageSender.getEncryptedMessages"
        )
        override fun getTimeSpentInGetEncryptedMessages() = timeSpentInGetEncryptedMessagesHistogram

        private val timeEncryptingMessagesHistogram =  registerHistogram(
            "libsignal__time_encrypting_messages",
            "Time spent in SignalServiceCipher.encrypt"
        )
        override fun getTimeEncryptingMessages() = timeEncryptingMessagesHistogram

        private val timeGettingPrekeysHistogram = registerHistogram(
            "libsignal__time_getting_prekeys",
            "Time spent in SignalServiceMessageSender.getEncryptedMessage fetching prekeys"
        )
        override fun getTimeGettingPrekeys() = timeGettingPrekeysHistogram

        val timeSpentSendingMessage = registerHistogram(
            "libsignal__time_spent_in_send_message",
            "Time spent in SignalServiceMessageSender.sendMessage"
        )
        val numberOfSleeps: Counter = registerCounter(
            "libsignal__number_of_sleeps",
            "Counts how frequently libsignal's UptimeSleepTimer sleeps a thread"
        )
    }

    object SignalSender {
        val numberOfMessageSends: Counter = registerCounter(
            "signal_sender__number_of_message_sends",
            "Counts number of attempted messages sent through libsignal"
        )

    }

    object SocketSender {
        val timeWaitingToSendMessageOverSocket= registerHistogram(
            "socket_sender__time_waiting_to_send_message_over_socket",
            "Time waiting in SocketSender queues to send a message over a socket."
        )
    }
}
