package info.signalboost.signalc.model

import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.UUID

object SignalServiceAddressConverter {
    fun String.asSignalServiceAddress() = SignalServiceAddress(null, this)
    fun UUID.asSignalServiceAddress() = SignalServiceAddress(this, null)
}