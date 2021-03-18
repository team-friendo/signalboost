package info.signalboost.signalc.model

import kotlinx.serialization.Serializable
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress
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

       fun SignalServiceEnvelope.asSignalcAddress() = sourceAddress.asSignalcAddress()
       fun VerifiedAccount.asSignalcAddress() = address.asSignalcAddress()
   }

   fun asSignalServiceAddress() = SignalServiceAddress(
       this.uuid?.let { Optional.of(UUID.fromString(it))} ?: Optional.absent(),
       this.number?.let { Optional.of(it) } ?: Optional.absent(),
   )
}