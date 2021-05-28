package info.signalboost.signalc.model

import info.signalboost.signalc.serialization.ThrowableSerializer
import kotlinx.serialization.*
import kotlinx.serialization.json.*
import info.signalboost.signalc.util.SocketHashCode
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

@Serializable
@Suppress("ACCIDENTAL_OVERRIDE")
sealed class SocketResponse {

    // SERIALIZATION
    fun toJson(): String = Json.encodeToString(this)

    // NON-SERIALIZABLE DATA TYPES

    data class Dropped(
        val sender: SignalcAddress,
        val recipient: SignalcAddress,
        val envelope: SignalServiceEnvelope,
    ): SocketResponse()

    object Empty : SocketResponse()

    // SHARED DATA TYPES

    @Serializable
    data class UserData(val username: String)

    // SERIALIABLE DATA TYPES

    @Serializable
    @SerialName("abort_warning")
    data class AbortWarning(
        val id: String,
        val socketHash: SocketHashCode,
    ) : SocketResponse()

    // TODO: Cleartext impl is gross! we keep the signald schema for now (for cutover), but we want to..
    //  - eliminate unnecessary deep nesting
    //  - call it "cleartext" not "message"
    //  - eliminate some of the very ambiguous naming (eg: "username")

    @Serializable
    @SerialName("message")
    data class Cleartext(
        val data: Data,
    ): SocketResponse() {
        @Serializable
        data class Data(
            val username: String,
            val source: SignalcAddress,
            val dataMessage: DataMessage,
            // signald provides and we omit:
            // type: String = "CLEARTEXT"
            // deviceId: Int
        )

        @Serializable
        data class DataMessage(
            val body: String,
            val expiresInSeconds: Int,
            val timestamp: Long,
            @Required
            val attachments: List<Attachment> = emptyList(),
            // NOTE: we don't support the below types of DataMessages, but they exist...
            // val endSession: Boolean = false,
            // val profileKeyUpdate: Boolean = false,
        )

        @Serializable
        data class Attachment(
            val blurHash: String?,
            val caption: String?,
            val contentType: String,
            val digest: String?,
            val filename: String,
            val height: Int,
            val id: String,
            val key: String,
            // val preview: String?,
            val size: Int?,
            val width: Int,
            val voiceNote: Boolean,
        )

        companion object {
            fun of(
                sender: SignalcAddress,
                recipient: SignalcAddress,
                body: String,
                attachments: List<Attachment> = emptyList(),
                expiresInSeconds: Int,
                timestamp: Long,
            ) = Cleartext(
                Data(
                    username = recipient.number!!,
                    source = sender,
                    dataMessage = DataMessage(
                        attachments = attachments,
                        body = body,
                        expiresInSeconds = expiresInSeconds,
                        timestamp = timestamp
                    ),
                )
            )
        }
    }

    // TODO: what does signald do here?
    @Serializable
    @SerialName("decryption_error")
    data class DecryptionError(
        val sender: SignalcAddress,
        val recipient: SignalcAddress,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse()

    @Serializable
    @SerialName("is_alive")
    data class IsAlive(val id: String): SocketResponse()

    @Serializable
    @SerialName("inbound_identity_failure")
    data class InboundIdentityFailure(
        val data: Data,
    ): SocketResponse() {
        @Serializable
        data class Data(
            val local_address: LocalAddress,
            val remote_address: RemoteAddress,
            @Required
            val fingerprint: String?
        )

        @Serializable
        @SerialName("local_address")
        data class LocalAddress(val number: String)

        @Serializable
        @SerialName("remote_address")
        data class RemoteAddress(val number: String)

        companion object {
            fun of(localAddress: SignalcAddress, remoteAddress: SignalcAddress, fingerprint: String? = null) =
                InboundIdentityFailure(Data(LocalAddress(localAddress.number!!), RemoteAddress(remoteAddress.number!!), fingerprint))
        }
    }

    @Serializable
    @SerialName("registration_succeeded")
    data class RegistrationSuccess(
        val id: String,
        val data: UserData,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest.Register) = RegistrationSuccess(
                request.id,
                UserData(request.username)
            )
        }
    }

    @Serializable
    @SerialName("registration_error")
    data class RegistrationError(
        val id: String,
        val data: UserData,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest.Register, error: Throwable) = RegistrationError(
                request.id,
                UserData(request.username),
                error
            )
        }
    }

    @Serializable
    @SerialName("unexpected_error") // TODO: just error or request_handling_error
    data class RequestHandlingError(
        val id: String,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
        val request: SocketRequest,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest, error: Throwable) = RequestHandlingError(
                request.id(),
                error,
                request
            )
        }
    }

    // TODO: what does signald do here? "unrecognized"?
    @Serializable
    @SerialName("request_invalid") // TODO: invalidRequest
    data class RequestInvalidError(
        // we don't provid an id field b/c parse did not succeed and we don't have one!
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
        val request: String,
    ): SocketResponse()

    // TODO(aguestuser|2021-02-24): gross!
    //  - "address" (which refers to recipient address) is highly ambiguous (recipient v. sender)
    //  - why don't we also pass the sender address?
    //  - this collapsing of success and failure variants into separate fields denoted by boolean flags
    //    is not very great...
    //  - we should have separate classes for SendSuccess/SendError cases? each error variant gets a type?
    @Serializable
    data class SendResult(
        val address: SignalcAddress,
        @Required
        val success: Success? = null,
        @Required
        val identityFailure: String? = null,
        @Required
        val networkFailure: Boolean = false,
        @Required
        val unregisteredFailure: Boolean = false,
        @Required
        val unknownError: Boolean = false,
        @Required
        val blocked: Boolean = false,
    ) {
        companion object {
            internal fun of(signalcSendResult: SignalcSendResult): SendResult {
                val sr = SendResult(signalcSendResult.address)
                return when(signalcSendResult) {
                    is SignalcSendResult.Blocked ->
                        sr.copy(blocked = true)
                    is SignalcSendResult.IdentityFailure ->
                        sr.copy(identityFailure = signalcSendResult.identityKey.fingerprint)
                    is SignalcSendResult.NetworkFailure ->
                        sr.copy(networkFailure = true)
                    is SignalcSendResult.Success ->
                        sr.copy(success = Success.from(signalcSendResult))
                    is SignalcSendResult.UnregisteredFailure ->
                        sr.copy(unregisteredFailure = true)
                    is SignalcSendResult.UnknownError ->
                        sr.copy(unknownError = true)
                }
            }
        }

        @Serializable
        data class Success(
            @Required
            val unidentified: Boolean = false, // TODO: default this to true in sealed-sender world?
            @Required
            val needsSync: Boolean = true, // TODO: default this to false in post-signald world?
        ) {
           companion object {
               fun from(sc: SignalcSendResult.Success) = Success(
                   sc.isUnidentified,
                   sc.isNeedsSync,
               )
           }
        }
    }

    // TODO: we have literally no use for this list format and should simply use SendResult once we
    //  are not coupled to signald's interface anymore...
    @Serializable
    @SerialName("send_results")
    data class SendResults(
        val id: String,
        val data: List<SendResult>,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest.Send, signalcSendResult: SignalcSendResult) = SendResults(
               id =  request.id,
               data = listOf(SendResult.of(signalcSendResult))
            )
        }
    }

    @Serializable
    @SerialName("set_expiration_failed")
    data class SetExpirationFailed(
        val id: String,
        val username: String,
        val recipientAddress: SignalcAddress,
        val resultType: String,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest.SetExpiration, result: SignalcSendResult) = SetExpirationFailed(
                request.id,
                request.username,
                request.recipientAddress,
                result::class.simpleName ?: "UNKNOWN",
            )
        }
    }

    @Serializable
    @SerialName("set_expiration_succeeded")
    data class SetExpirationSuccess(
        val id: String,
        val username: String,
        val recipientAddress: SignalcAddress,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest.SetExpiration) = SetExpirationSuccess(
                request.id,
                request.username,
                request.recipientAddress,
            )
        }
    }

    @Serializable
    @SerialName("subscription_succeeded")
    data class SubscriptionSuccess(
        val id: String,
        val username: String,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest.Subscribe) = SubscriptionSuccess(
                request.id,
                request.username,
            )
        }
    }

    @Serializable
    @SerialName("subscription_failed")
    data class SubscriptionFailed(
        val id: String,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse()

    @Serializable
    @SerialName("subscription_disrupted")
    data class SubscriptionDisrupted(
        val id: String,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse()

    @Serializable
    @SerialName("trusted_fingerprint") // TODO: change to trust_success
    data class TrustSuccess(
        val id: String,
        val data: Data,
    ): SocketResponse() {
        @Serializable
        data class Data(
            val message: String,
            val request: SocketRequest.Trust,
        )
        companion object {
            fun of(request: SocketRequest.Trust) = TrustSuccess(
                request.id,
                Data("", request) // TODO: remove unused message from TrustData
            )
        }
    }

    @Serializable
    @SerialName("unsubscribe_succeeded")
    data class UnsubscribeSuccess(
        val id: String,
        val username: String,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest.Unsubscribe) = UnsubscribeSuccess(
                request.id,
                request.username,
            )
        }
    }

    @Serializable
    @SerialName("unsubscribe_failed")
    data class UnsubscribeFailure(
        val id: String,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse()

    @Serializable
    @SerialName("verification_succeeded") // TODO: verificationSucceeded
    data class VerificationSuccess(
        val id: String,
        val data: UserData,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest.Verify) = VerificationSuccess(
                request.id,
                UserData(request.username)
            )
        }
    }

    @Serializable
    @SerialName("verification_error") // TODO: camelcase
    data class VerificationError(
        val id: String,
        val data: UserData,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse() {
        companion object {
            fun of(request: SocketRequest.Verify, error: Throwable) = VerificationError(
                request.id,
                UserData(request.username),
                error,
            )
        }
    }

    @Serializable
    @SerialName("version")
    data class Version(
        val id: String,
        val data: VersionData,
    ): SocketResponse() {
        @Serializable
        data class VersionData(val version: String)
    }
}