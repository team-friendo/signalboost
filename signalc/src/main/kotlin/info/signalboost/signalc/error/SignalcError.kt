package info.signalboost.signalc.error

object SignalcError {
    class MessagePipeNotCreated(
        val error: Throwable,
    ): Exception(error.message, error)

    class WriterMissing(message: String): Exception(message)
    class UnregisteredUser(username: String): Exception("Can't subscribe to messages for $username: not registered.")
}