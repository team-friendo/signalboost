package info.signalboost.signalc.exception

import info.signalboost.signalc.serialization.ByteArrayEncoding.toHex

object SignalcError {
    class MessagePipeNotCreated(val error: Throwable): Exception(error.message, error)
    object AuthorizationFailed: Exception("Authorization with Signal Service failed.")
    object RegistrationOfRegsisteredUser: Exception("Cannot register account that is already registered")
    object SubscriptionOfUnregisteredUser: Exception("Cannot subscribe to messages for unregistered account")
    class UpdateToNonExistentFingerprint(
        accountId: String,
        contactId: Int,
        fingerprint: ByteArray,
    ): Exception("Cannot update non-existent fingerprint ${fingerprint.toHex()} for contact $contactId of account $accountId")
    object UnsubscribeUnregisteredUser: Exception("Cannot unsubscribe to messages for unregistered account")
    object VerificationOfNewUser: Exception("Cannot verify a new (unregistered) account")
    object VerificationOfVerifiedUser: Exception("Cannot verify account that is already verified")

    class WriterMissing(message: String): Exception(message)
}