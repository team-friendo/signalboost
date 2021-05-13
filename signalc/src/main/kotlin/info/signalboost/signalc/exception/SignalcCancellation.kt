package info.signalboost.signalc.exception

import java.util.concurrent.CancellationException

object SignalcCancellation {
    object SubscriptionCancelledByClient: CancellationException("Subscription purposefully cancelled by system.")

    class SubscriptionDisrupted(error: Throwable):
        CancellationException("Subscription cancelled by system error: ${error.stackTraceToString()}")
}