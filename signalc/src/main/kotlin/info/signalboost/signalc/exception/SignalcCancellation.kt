package info.signalboost.signalc.exception

import java.util.concurrent.CancellationException

object SignalcCancellation {
    object SubscriptionCancelled: CancellationException("Subscription purposefully cancelled by system.")
}