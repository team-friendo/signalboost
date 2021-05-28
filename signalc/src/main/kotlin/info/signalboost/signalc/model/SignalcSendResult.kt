package info.signalboost.signalc.model

import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import org.whispersystems.libsignal.IdentityKey
import org.whispersystems.signalservice.api.messages.SendMessageResult

sealed class SignalcSendResult {
    companion object {
        fun SendMessageResult.asSingalcSendResult(): SignalcSendResult {
            val scAddress = address.asSignalcAddress()
            if(success != null) return Success(
                address = scAddress,
                isUnidentified = success.isUnidentified,
                isNeedsSync = success.isNeedsSync,
                duration = success.duration,
            )
            if(isNetworkFailure) return NetworkFailure(scAddress)
            if(isUnregisteredFailure) return UnregisteredFailure(scAddress)
            if(identityFailure != null) return IdentityFailure(scAddress, identityFailure.identityKey)
            return UnknownError(scAddress)
        }
    }

    abstract val address: SignalcAddress

    data class Blocked(override val address: SignalcAddress): SignalcSendResult()
    data class IdentityFailure(override val address: SignalcAddress, val identityKey: IdentityKey): SignalcSendResult()
    data class NetworkFailure(override val address: SignalcAddress): SignalcSendResult()
    data class Success(
        override val address: SignalcAddress,
        val isUnidentified: Boolean = false,
        val isNeedsSync: Boolean = true,
        val duration: Long = 0L,
    ): SignalcSendResult()
    data class UnregisteredFailure(override val address: SignalcAddress): SignalcSendResult()
    data class UnknownError(override val address: SignalcAddress): SignalcSendResult()
}
