package info.signalboost.signalc.model

import kotlinx.serialization.*
import kotlinx.serialization.json.*

@Serializable
data class SocketAddress(
    val number: String?,
    val uuid: String?,
)

@Serializable
sealed class SocketInMessage {

    companion object {
        fun fromJson(jsonString: String): SocketInMessage =
            Json.decodeFromString(jsonString)
    }

    fun toJson(): String = Json.encodeToString(this)

    @Serializable
    @SerialName("send") // will be serialized as `type` field in JSON representation
    data class Send(
        val username: String,
        val recipientAddress: SocketAddress,
        val messageBody: String,
        val attachments: List<SocketInAttachment>,
        // we could optionally support a QuoteObject here, but we don't. see:
        // https://docs.signald.org/structures/v1/JsonQuote.html
    ): SocketInMessage() {

    }

    @Serializable
    @SerialName("subscribe") // will be serialized as `type` field in JSON representation
    data class Subscribe(
        val username: String,
    ): SocketInMessage()

}

@Serializable
data class SocketInAttachment(
   val filename: String, // (The filename of the attachment) == `storedFilename`
   val caption: String?,
   val width: Int,
   val height: Int,
   val voiceNote: Boolean = false, //  (True if this attachment is a voice note)
   val preview: String? = null,// (The preview data to send, base64 encoded)
)


