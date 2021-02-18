package info.signalboost.signalc.model

import info.signalboost.signalc.serialization.ThrowableSerializer
import kotlinx.serialization.*
import kotlinx.serialization.json.*
import info.signalboost.signalc.util.SocketHashCode
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope

@Serializable
sealed class SocketResponse {

    // SERIALIZATION
    companion object {
        fun fromJson(jsonString: String): SocketResponse =
            try {
                Json.decodeFromString(jsonString)
            } catch(e: Throwable) {
                ParseError(e, jsonString)
            }
    }
    fun toJson(): String = Json.encodeToString(this)
    data class ParseError(val cause: Throwable, val input: String): SocketResponse()


    // NON-SERIALIZABLE DATA TYPES

    data class Dropped(
        val sender: SocketAddress,
        val recipient: SocketAddress,
        val envelope: SignalServiceEnvelope,
    ): SocketResponse()

    object Empty : SocketResponse()


    // SERIALIABLE DATA TYPES

    @Serializable
    data class Attachment(val filepath: String)

    @Serializable
    @SerialName("message")
    data class Cleartext(
        val sender: SocketAddress,
        val recipient: SocketAddress,
        val body: String,
        @Required
        val attachments: List<Attachment> = emptyList()
    ): SocketResponse()

    @Serializable
    @SerialName("decryptionError")
    data class DecryptionException(
        val sender: SocketAddress,
        val recipient: SocketAddress,
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse()


    @Serializable
    @SerialName("error")
    data class RequestHandlingException(
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
        val request: SocketRequest,
    ): SocketResponse()

    @Serializable
    @SerialName("invalid")
    data class RequestInvalidException(
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
        val request: String,
    ): SocketResponse()


    // TODO: flesh these out!
    @Serializable
    @SerialName("sendSuccess")
    object SendSuccess: SocketResponse()

    @Serializable
    @SerialName("sendError")
    object SendException: SocketResponse()

    @Serializable
    object SubscriptionSucceeded: SocketResponse()

    @Serializable
    @SerialName("subscriptionFailed")
    data class SubscriptionFailed(
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse()

    @Serializable
    @SerialName("subscriptionDisrupted")
    data class SubscriptionDisrupted(
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
    ): SocketResponse()

    @Serializable
    @SerialName("shutdown")
    data class Shutdown(
        val socketHash: SocketHashCode,
    ) : SocketResponse()
}