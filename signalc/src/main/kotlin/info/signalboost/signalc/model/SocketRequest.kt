package info.signalboost.signalc.model

import kotlinx.serialization.*
import kotlinx.serialization.json.*

@Serializable
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
    data class ParseError(val cause: Throwable, val input: String): SocketRequest()

    // DATA

    @Serializable
    @SerialName("abort")
    object Abort: SocketRequest()

    @Serializable
    @SerialName("close")
    object Close: SocketRequest()

    @Serializable
    @SerialName("send") // will be serialized as `type` field in JSON representation
    data class Send(
        val username: String,
        val recipientAddress: SocketAddress,
        val messageBody: String,
        val attachments: List<Attachment>,
        // we could optionally support a QuoteObject here, but we don't. see:
        // https://docs.signald.org/structures/v1/JsonQuote.html
    ): SocketRequest()

    @Serializable
    @SerialName("subscribe") // will be serialized as `type` field in JSON representation
    data class Subscribe(
        val username: String,
    ): SocketRequest()


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



