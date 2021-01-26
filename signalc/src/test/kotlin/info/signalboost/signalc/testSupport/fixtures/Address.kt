package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.testSupport.fixtures.PhoneNumber.genPhoneNumber
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.*

object Address {
    fun genSignalServiceAddress(verified: Boolean = true): SignalServiceAddress =
        SignalServiceAddress(
            if (verified) UUID.randomUUID() else null,
            genPhoneNumber(),
        )
}