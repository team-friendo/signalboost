package info.signalboost.signalc.model

object SignalcError {
    class MessagePipeNotCreated(
        val error: Throwable,
    ): Exception(error.message, error)

    class WriterMissing(message: String): Exception(message)
}