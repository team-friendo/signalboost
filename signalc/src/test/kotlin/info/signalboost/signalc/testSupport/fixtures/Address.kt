package info.signalboost.signalc.testSupport.fixtures

import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.*
import kotlin.random.Random


object Address {
    fun genPhoneNumber(): String =
        "+1" + List(10) { Random.nextInt(0, 9) }.joinToString("")

    fun genUuidStr(): String = UUID.randomUUID().toString()

    fun genSignalServiceAddress(verified: Boolean = true): SignalServiceAddress =
        SignalServiceAddress(
            if (verified) UUID.randomUUID() else null,
            genPhoneNumber(),
        )
}