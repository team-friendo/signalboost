package info.signalboost.signalc.serialization

import kotlinx.serialization.*
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

object ThrowableSerializer: KSerializer<Throwable> {
    @Serializable
    @SerialName("Throwable")
    data class ThrowableSurrogate(val cause: String, val message: String)

    override val descriptor: SerialDescriptor = ThrowableSurrogate.serializer().descriptor

    override fun serialize(encoder: Encoder, value: Throwable) {
        val surrogate = ThrowableSurrogate(cause = value.javaClass.name, message = value.message ?: "")
        encoder.encodeSerializableValue(ThrowableSurrogate.serializer(), surrogate)
    }

    override fun deserialize(decoder: Decoder): Throwable {
        val surrogate = decoder.decodeSerializableValue(ThrowableSurrogate.serializer())
        return Throwable(surrogate.message)
    }
}

