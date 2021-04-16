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
        const val DEFAULT_EXPIRY_TIME = 60 * 60 * 24 // 1 day
        fun fromJson(jsonString: String): SocketRequest =
            try {
                Json.decodeFromString(jsonString)
            } catch(e: Throwable) {
                ParseError("", e, jsonString)
            }
    }
    fun toJson(): String = Json.encodeToString(this)

    // ACCESSORS
    fun id(): String = when (this) {
        // - if we make `id` a field on `SocketRequest` itself then override it in subclasses
        //   it messes up serialization logic
        // - so... we provide this hacky way to access the id of a `SocketRequest` regardless of type
        // - perhaps we will dig into `@Serializable` at some point to come up w/ a cleaner solution!
        is Abort -> id
        is Close -> id
        is IsAlive -> id
        is ParseError -> id
        is Register -> id
        is Send -> id
        is SetExpiration -> id
        is Subscribe -> id
        is Trust -> id
        is Unsubscribe -> id
        is Verify -> id
        is Version -> id
    }

    fun username(): String? = when(this) {
        is Register -> username
        is Send -> username
        is SetExpiration -> username
        is Subscribe -> username
        is Trust -> username
        is Unsubscribe -> username
        is Verify -> username
        else -> null
    }

    // DATA TYPES

    @Serializable
    @SerialName("abort")
    data class Abort(val id: String): SocketRequest()

    @Serializable
    @SerialName("close")
    data class Close(val id: String): SocketRequest()

    @Serializable
    @SerialName("is_alive")
    data class IsAlive(val id: String): SocketRequest()

    @Serializable
    data class ParseError(
        val id: String = "",
        @Serializable(ThrowableSerializer::class)
        val error: Throwable,
        val input: String,
    ): SocketRequest()

    @Serializable
    @SerialName("register")
    data class Register(
        val id: String = KeyUtil.genUuidStr(),
        val username: String, // e164 phone number
        val captcha: String? = null,
    ): SocketRequest()

    @Serializable
    @SerialName("send") // will be serialized as `type` field in JSON representation
    data class Send(
        val id: String,
        val username: String,
        val recipientAddress: SignalcAddress,
        val messageBody: String,
        val attachments: List<Attachment> = emptyList(),
        val expiresInSeconds: Int = DEFAULT_EXPIRY_TIME,
        // we could optionally support a QuoteObject here, but we don't. see:
        // https://docs.signald.org/structures/v1/JsonQuote.html
    ): SocketRequest() {
        @Serializable
        data class Attachment(
            val blurHash: String? = null,
            val caption: String? = null,
            val contentType: String,
            val digest: String? = null,
            val filename: String,
            val height: Int,
            val id: String,
            val key: String? = null,
            val size: Int? = null,
            val width: Int,
            val voiceNote: Boolean,
        )
    }

    @Serializable
    @SerialName("set_expiration")
    data class SetExpiration(
        val id: String,
        val username: String, // e164 number
        val recipientAddress: SignalcAddress,
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
        val recipientAddress: SignalcAddress,
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