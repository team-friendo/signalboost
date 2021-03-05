package info.signalboost.signalc.testSupport.matchers

import io.mockk.MockKMatcherScope
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage

object SignalMessageMatchers {

    fun MockKMatcherScope.signalDataMessage(
        body: String? = null,
        timestamp: Long? = null,
        expiresInSeconds: Int? = null,
    ): SignalServiceDataMessage = match {
        // check for equality of each provided param. if param not provided, don't check it!
        body?.let{ _ -> it.body.or("") == body } ?: true &&
            timestamp?.let { _ -> it.timestamp == timestamp } ?: true &&
            expiresInSeconds?.let { _ -> it.expiresInSeconds == expiresInSeconds } ?: true
    }
}