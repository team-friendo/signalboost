package info.signalboost.signalc.model

import kotlinx.serialization.Serializable
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.*

@Serializable
data class SerializableAddress(
    val number: String?,
    val uuid: String? = null,
) {
   companion object {
       fun SignalServiceAddress.asSerializable(): SerializableAddress = SerializableAddress(
           this.number.orNull(),
           this.uuid.orNull().toString(),
       )

       fun SignalServiceEnvelope.asSerializable() = sourceAddress.asSerializable()
       fun VerifiedAccount.asSerializable() = address.asSerializable()
   }

   fun asSignalAddress(): SignalServiceAddress = SignalServiceAddress(
       this.uuid?.let { Optional.of(UUID.fromString(it))} ?: Optional.absent(),
       this.number?.let { Optional.of(it) } ?: Optional.absent(),
   )
}