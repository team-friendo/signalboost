package info.signalboost.signalc.model

import org.whispersystems.signalservice.api.messages.SendMessageResult

enum class SendResultType {
        SUCCESS,
        NETWORK_FAILURE,
        UNREGISTERED_FAILURE,
        IDENTITY_FAILURE,
        UNKNOWN_ERROR;

    companion object {
        fun SendMessageResult.type(): SendResultType {
            if(success != null) return SUCCESS
            if(isNetworkFailure) return NETWORK_FAILURE
            if(isUnregisteredFailure) return UNREGISTERED_FAILURE
            if(identityFailure != null) return IDENTITY_FAILURE
            return UNKNOWN_ERROR
        }
    }
}