package info.signalboost.signalc.metrics

import io.prometheus.client.Counter
import io.prometheus.client.Histogram
import org.whispersystems.signalservice.api.LibSignalMetrics

object Metrics {
    // CONVENTIONS
    // Name: Location of metric, namespaced by module, use the function name or what code the metric is wrapping
    // Help: Time spent in X place, doing Y thing(s)
    private fun histogramOf(name: String, help: String): Histogram =
        Histogram.build().name(name).help(help).register()

    private fun counterOf(name: String, help: String): Counter =
        Counter.build().name(name).help(help).register()

    object AccountManager {
        val timeToLoadVerifiedAccount =
            histogramOf(
                "account_manager__time_to_load_verified_account",
                "Time spent in AccountManger.loadVerified"
            )
    }

    object LibSignal: LibSignalMetrics {
        private val timeSendingMessageOverNetworkHistogram =  histogramOf(
            "libsignal__time_sending_message_over_network",
            "Time spent in SignalServiceMessageSender.sendMessage sending message over network"
        )
        override fun getTimeSendingMessageOverNetwork() = timeSendingMessageOverNetworkHistogram

        private val timeSpentInGetEncryptedMessagesHistogram = histogramOf(
            "libsignal__time_getting_encrypted_messages",
            "Time spent in SignalServiceMessageSender.getEncryptedMessages, which makes calls to the" +
                    "SessionStore, fetches prekeys if it is a new session, and encrypts the message for every" +
                    "device of the recipient"
        )
        override fun getTimeSpentInGetEncryptedMessages() = timeSpentInGetEncryptedMessagesHistogram

        private val timeEncryptingMessagesHistogram =  histogramOf(
            "libsignal__time_encrypting_messages",
            "Time spent in SignalServiceCipher.encrypt, which encrypts a plaintext message"
        )
        override fun getTimeEncryptingMessages() = timeEncryptingMessagesHistogram

        private val timeGettingPrekeysHistogram = histogramOf(
            "libsignal__time_getting_prekeys",
            "Time spent in SignalServiceMessageSender.getEncryptedMessage fetching prekeys from the server"
        )
        override fun getTimeGettingPrekeys() = timeGettingPrekeysHistogram

        val timeSpentSendingMessage = histogramOf(
            "libsignal__time_spent_in_send_message",
            "Time spent in SignalServiceMessageSender.sendMessage"
        )
    }

    object SignalSender {
        val numberOfMessageSends: Counter = counterOf(
            "signal_sender__number_of_message_sends",
            "Counts number of attempted messages sent through libsignal"
        )

    }

    object SocketReceiver {
        val numberOfResubscribes: Counter = counterOf(
            "socket_receiver__number_of_resubscribes",
            "Counts number of attempts to resubscribe an account"
        )
    }

    object SocketSender {
        val timeWaitingToSendMessageOverSocket= histogramOf(
            "socket_sender__time_waiting_to_send_message_over_socket",
            "Time waiting in SocketSender queues to send a message over a socket."
        )
    }
}
