package info.signalboost.signalc.model

object SignalcError {
    class MessagePipeNotCreated(
        val error: Throwable,
    ) : Throwable() {
        override val cause = error
        override val message = error.message
    }
}