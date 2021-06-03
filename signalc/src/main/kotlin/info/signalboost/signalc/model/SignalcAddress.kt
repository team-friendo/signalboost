package info.signalboost.signalc.model

import info.signalboost.signalc.serialization.UUIDSerializer
import kotlinx.serialization.Serializable
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import org.whispersystems.signalservice.api.push.SignalServiceAddress.DEFAULT_DEVICE_ID
import java.lang.IllegalStateException
import java.util.*

@Serializable
@Suppress("ACCIDENTAL_OVERRIDE")
data class SignalcAddress(
    val number: String? = null,
    @Serializable(UUIDSerializer::class)
    val uuid: UUID? = null,
) {
    companion object {
        fun SignalServiceAddress.asSignalcAddress() = SignalcAddress(
            this.number.orNull(),
            this.uuid.orNull(),
        )

        fun SignalServiceEnvelope.asSignalcAddress() = SignalcAddress(
            number = sourceE164.orNull()?.ifEmpty { null },
            uuid = sourceUuid.orNull()?.let{ if(it.isEmpty()) null else  UUID.fromString (it) },
        ).also {
            if (it.number == null && it.uuid == null) {
                throw IllegalStateException(
                    "Cannot construct SignalcAddress with null number & uuid."
                )
            }
        }
    }
    val identifier: String
        get() = uuid?.toString() ?: number!!

    fun asSignalServiceAddress() = SignalServiceAddress(
        this.uuid?.let { Optional.of(it)} ?: Optional.absent(),
        this.number?.let { Optional.of(it) } ?: Optional.absent(),
    )

    /**
     * Convert a signalc address to a signal protcol address.
     * --
     * Will pass a dummy device id (the default lowest value of 1) if none provided, making it safe to use
     * only if you know the device id or if you are in a context like SignalcIdentityStore that (weirdly!)
     * needs to consume a SignalProtocolAddress, but doesn't actually care about the device id.
     **/
    fun asSignalProtocolAddress(deviceId: Int = DEFAULT_DEVICE_ID) = SignalProtocolAddress(identifier, deviceId)
}