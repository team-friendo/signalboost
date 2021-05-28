package info.signalboost.signalc.metrics

import io.prometheus.client.Counter
import io.prometheus.client.Histogram
import org.whispersystems.signalservice.api.LibSignalMetrics

object Metrics {
    /******** CONVENTIONS ************
     * Name: Location of metric, namespaced by module, use the function name or what code the metric is wrapping
     * Help: Time spent in X place, doing Y thing(s)
     *********************************/
    private fun histogramOf(name: String, help: String): Histogram =
        Histogram.build().name(name).help(help).register()

    private fun counterOf(name: String, help: String, vararg labelNames: String): Counter =
        Counter.build().name(name).help(help).labelNames(*labelNames).register()

    object AccountManager {
        val numberOfPreKeyRefreshes = counterOf(
            "account_manager__number_of_prekey_refreshes",
        "Number of times AccountManager publishes new prekeys because reserves have dipped below 10",
        )

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

    object SignalReceiver {
        val numberOfMessagesReceived: Counter = counterOf(
            "signal_receiver__number_of_messages_received",
            "Counts number of inbound PREKEY_BUNDLE messages we receive from signal server when users try to establish new sessions." +
                    "If we often receive a high number of these in quick succession, consider throttling prekey replenish jobs.",
            "envelope_type",
        )
    }

    object SignalSender {
        val numberOfUnsealedMessagesProduced: Counter = counterOf(
            "signal_sender__number_of_unsealed_messages_produced",
            "Counts number of unsealed-sender messages produced (though not necessarily sent), which we care about b/c these are counted against per-ip and per-sender rate limits",
            "account_id",
        )


        val numberOfUnsealedMessagesSent: Counter = counterOf(
            "signal_sender__number_of_unsealed_messages_sent",
            "Counts number of unsealed-sender messages sent, which we care about b/c these are counted against per-ip and per-sender rate limits",
        "account_id",
        )

        val numberOfMessagesSent: Counter = counterOf(
            "signal_sender__number_of_messages_sent",
            "Counts number of attempted messages sent through libsignal",
        )
    }

    object SocketReceiver {
        val numberOfResubscribes: Counter = counterOf(
            "socket_receiver__number_of_resubscribes",
            "Counts number of attempts to resubscribe an account",
        )
    }

    object SocketSender {
        val timeWaitingToSendMessageOverSocket= histogramOf(
            "socket_sender__time_waiting_to_send_message_over_socket",
            "Time waiting in SocketSender queues to send a message over a socket.",
        )
    }
}
