package info.signalboost.signalc.model

import kotlinx.serialization.Serializable
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.lang.IllegalStateException
import java.util.*

@Serializable
@Suppress("ACCIDENTAL_OVERRIDE")
data class SignalcAddress(
    val number: String?,
    val uuid: String? = null,
) {
   companion object {
       fun SignalServiceAddress.asSignalcAddress() = SignalcAddress(
           this.number.orNull(),
           this.uuid.orNull()?.toString(),
       )

       fun SignalServiceEnvelope.asSignalcAddress() = SignalcAddress(
           number = sourceE164.orNull(),
           uuid = sourceUuid.orNull(),
       ).also {
           if (it.number == null && it.uuid == null) {
               throw IllegalStateException(
                   "Cannot construct SignalcAddress with null number & uuid."
               )
           }
       }
   }

   // TODO(aguestuser|2021-05-26): refactor to prefer UUID once we migrate away from phone numbers!
   val id: String
     get() = number ?: uuid!!

   fun asSignalServiceAddress() = SignalServiceAddress(
       this.uuid?.let { Optional.of(UUID.fromString(it))} ?: Optional.absent(),
       this.number?.let { Optional.of(it) } ?: Optional.absent(),
   )
}