package info.signalboost.signalc.model

import info.signalboost.signalc.model.SendResultType.Companion.type
import info.signalboost.signalc.serialization.ThrowableSerializer
import kotlinx.serialization.*
import kotlinx.serialization.json.*
import info.signalboost.signalc.util.SocketHashCode
import org.whispersystems.signalservice.api.messages.SendMessageResult
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

@Serializable
@Suppress("ACCIDENTAL_OVERRIDE")
sealed class SocketResponse {

    // SERIALIZATION
    fun toJson(): String = Json.encodeToString(this)

    // NON-SERIALIZABLE DATA TYPES

    data class Dropped(
        val sender: SerializableAddress,
        val recipient: SerializableAddress,
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
            val source: SerializableAddress,
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
            // signald includes the below, but we should signal this with different message types
            // val endSession: Boolean = false,
            // val profileKeyUpdate: Boolean = false,
        )

        @Serializable
        data class Attachment(val filepath: String) // TODO: flush this out!

        companion object {
            fun of(
                sender: SerializableAddress,
                recipient: SerializableAddress,
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
        val sender: SerializableAddress,
        val recipient: SerializableAddress,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse()

    @Serializable
    @SerialName("registration_succeeded")
    data class RegistrationSuccess(
        val id: String,
        val data: UserData,
    ): SocketResponse()


    @Serializable
    @SerialName("unexpected_error") // TODO: just error or request_handling_error
    data class RequestHandlingError(
        val id: String,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
        val request: SocketRequest,
    ): SocketResponse()


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
    //  - why don't we walso pass the sender address?
    //  - this collapsing of success and failure variants into separate fields denoted by boolean flags
    //    is not very great...
    //  - we should have separate classes for SendSuccess/SendError cases? each error variant gets a type?
    @Serializable
    data class SendResult(
        val address: SerializableAddress,
        @Required
        val success: Success? = null,
        @Required
        val identityFailure: String? = null,
        @Required
        val networkFailure: Boolean = false,
        @Required
        val unregisteredFailure: Boolean = false,
        @Required
        val unknownError: Boolean = false
    ) {
        companion object {
            internal fun of(request: SocketRequest.Send, signalSendResult: SendMessageResult): SendResult =
                when(signalSendResult.type()) {
                    SendResultType.SUCCESS -> success(request)
                    SendResultType.IDENTITY_FAILURE -> identityFailure(
                        request,
                        signalSendResult.identityFailure.identityKey.fingerprint
                    )
                    SendResultType.NETWORK_FAILURE -> networkFailure(request)
                    SendResultType.UNREGISTERED_FAILURE -> unregisteredFailure(request)
                    SendResultType.UNKNOWN_ERROR -> unknownError(request)
            }

            internal fun success(request: SocketRequest.Send) = SendResult(
                request.recipientAddress,
                success = Success(),
            )

            internal fun identityFailure(request: SocketRequest.Send, fingerprint: String) = SendResult(
                request.recipientAddress,
                identityFailure = fingerprint
            )

            internal fun unregisteredFailure(request: SocketRequest.Send) = SendResult(
                request.recipientAddress,
                unregisteredFailure = true,
            )

            internal fun networkFailure(request: SocketRequest.Send) = SendResult(
                request.recipientAddress,
                networkFailure = true,
            )

            internal fun unknownError(request: SocketRequest.Send) = SendResult(
                request.recipientAddress,
                unknownError = true,
            )
        }

        @Serializable
        data class Success(
            @Required
            val unidentified: Boolean = false,
            @Required
            val needsSync: Boolean = true, // TODO: default this to false in post-signald world
        )
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
            fun of(request: SocketRequest.Send, signalSendResult: SendMessageResult) = SendResults(
               id =  request.id,
               data = listOf(SendResult.of(request, signalSendResult))
            )

            fun success(request: SocketRequest.Send) = SendResults(
                id =  request.id,
                data = listOf(SendResult.success(request))
            )

            fun identityFailure(request: SocketRequest.Send, fingerprint: String) = SendResults(
                id =  request.id,
                data = listOf(SendResult.identityFailure(request, fingerprint))
            )

            fun unregisteredFailure(request: SocketRequest.Send) = SendResults(
                id =  request.id,
                data = listOf(SendResult.unregisteredFailure(request))
            )

            fun networkFailure(request: SocketRequest.Send) = SendResults(
                id =  request.id,
                data = listOf(SendResult.networkFailure(request))
            )
        }
    }

    @Serializable
    @SerialName("subscription_succeeded")
    data class SubscriptionSuccess(val id: String): SocketResponse()

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
        val data: TrustData,
    ): SocketResponse() {
        @Serializable
        data class TrustData(
            val message: String,
            val request: SocketRequest.Trust,
        )
    }

    @Serializable
    @SerialName("verification_succeeded") // TODO: verificationSucceeded
    data class VerificationSuccess(
        val id: String,
        val data: UserData,
    ): SocketResponse()

    @Serializable
    @SerialName("verification_error") // TODO: camelcase
    data class VerificationError(
        val id: String,
        val data: UserData,
    ): SocketResponse()

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