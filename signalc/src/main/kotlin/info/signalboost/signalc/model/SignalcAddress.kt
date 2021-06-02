package info.signalboost.signalc.model

import info.signalboost.signalc.serialization.UUIDSerializer
import kotlinx.serialization.Serializable
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress
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
           number = sourceE164.orNull()?.let{ if(it.isEmpty()) null else it},
           uuid = sourceUuid.orNull()?.let{ if(it.isEmpty()) null else  UUID.fromString (it) },
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
     get() = number ?: uuid!!.toString()

   fun asSignalServiceAddress() = SignalServiceAddress(
       this.uuid?.let { Optional.of(it)} ?: Optional.absent(),
       this.number?.let { Optional.of(it) } ?: Optional.absent(),
   )
}