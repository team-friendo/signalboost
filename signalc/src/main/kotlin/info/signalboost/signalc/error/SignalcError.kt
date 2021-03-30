package info.signalboost.signalc.error

object SignalcError {
    class MessagePipeNotCreated(val error: Throwable): Exception(error.message, error)
    object AuthorizationFailed: Exception("Authorization with Signal Service failed.")
    object SubscriptionOfUnregisteredUser: Exception("Cannot subscribe to messages for unregistered account")
    object RegistrationOfRegsisteredUser: Exception("Cannot register account that is already registered")
    object VerificationOfNewUser: Exception("Cannot verify a new (unregistered) account")
    object VerificationOfVerifiedUser: Exception("Cannot verify account that is already verified")
    class WriterMissing(message: String): Exception(message)
}