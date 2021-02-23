package info.signalboost.signalc.model

import info.signalboost.signalc.serialization.ThrowableSerializer
import info.signalboost.signalc.util.KeyUtil
import kotlinx.serialization.*
import kotlinx.serialization.json.*

@Serializable
@Suppress("ACCIDENTAL_OVERRIDE")
sealed class SocketRequest {

    // SERIALIZATION
    companion object {
        fun fromJson(jsonString: String): SocketRequest =
            try {
                Json.decodeFromString(jsonString)
            } catch(e: Throwable) {
                ParseError(e, jsonString)
            }
    }
    fun toJson(): String = Json.encodeToString(this)

    // DATA TYPES

    @Serializable
    @SerialName("abort")
    data class Abort(val id: String): SocketRequest()

    @Serializable
    @SerialName("close")
    data class Close(val id: String): SocketRequest()

    @Serializable
    data class ParseError(
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
        val input: String,
    ): SocketRequest()

    @Serializable
    @SerialName("register")
    data class Register(
        val id: String = KeyUtil.genUuidStr(),
        val username: String, // e164 phone number
        val captchaToken: String? = null,
    ): SocketRequest()

    @Serializable
    @SerialName("send") // will be serialized as `type` field in JSON representation
    data class Send(
        val id: String,
        val username: String,
        val recipientAddress: SerializableAddress,
        val messageBody: String,
        val attachments: List<Attachment>,
        // we could optionally support a QuoteObject here, but we don't. see:
        // https://docs.signald.org/structures/v1/JsonQuote.html
    ): SocketRequest() {
        @Serializable
        data class Attachment(
            val filename: String, // (The filename of the attachment) == `storedFilename`
            val caption: String?,
            val width: Int,
            val height: Int,
            val voiceNote: Boolean = false, //  (True if this attachment is a voice note)
            val preview: String? = null,// (The preview data to send, base64 encoded)
        )
    }

    @Serializable
    @SerialName("set_expiration")
    data class SetExpiration(
        val id: String,
        val username: String, // e164 number
        val recipientAddress: SerializableAddress,
        val expiresInSeconds: Int,
    ): SocketRequest()

    @Serializable
    @SerialName("subscribe")
    data class Subscribe(
        val id: String,
        val username: String,
    ): SocketRequest()

    @Serializable
    @SerialName("trust")
    data class Trust(
        val id: String,
        val username: String,
        val recipientAddress: SerializableAddress,
        val fingerprint: String,
    ): SocketRequest()

    @Serializable
    @SerialName("unsubscribe")
    data class Unsubscribe(
        val id: String,
        val username: String,
    ): SocketRequest()

    @Serializable
    @SerialName("verify")
    data class Verify(
        val id: String = KeyUtil.genUuidStr(),
        val username: String, // e164 number
        val code: String,
    ): SocketRequest()

    @Serializable
    @SerialName("version")
    data class Version(val id: String): SocketRequest()
}