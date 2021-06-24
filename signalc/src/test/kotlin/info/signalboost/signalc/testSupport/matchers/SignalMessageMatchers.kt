package info.signalboost.signalc.testSupport.matchers

import io.mockk.MockKMatcherScope
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.messages.SignalServiceAttachment
import org.whispersystems.signalservice.api.messages.SignalServiceDataMessage
import org.whispersystems.signalservice.api.messages.SignalServiceReceiptMessage

object SignalMessageMatchers {

    fun MockKMatcherScope.signalDataMessage(
        body: String? = null,
        timestamp: Long? = null,
        expiresInSeconds: Int? = null,
        attachments: Optional<List<SignalServiceAttachment>>? = null,
        isProfileKeyUpdate: Boolean? = null,
        profileKey: ByteArray? = null,
    ): SignalServiceDataMessage = match {
        // check for equality of each provided param. if param not provided, don't check it!
        body?.let{ _ -> it.body.or("") == body } ?: true &&
                timestamp?.let { _ -> it.timestamp == timestamp } ?: true &&
                expiresInSeconds?.let { _ -> it.expiresInSeconds == expiresInSeconds } ?: true &&
                attachments?.let { _ -> it.attachments == attachments } ?: true &&
                isProfileKeyUpdate?.let { _ -> it.isProfileKeyUpdate == isProfileKeyUpdate} ?: true &&
                profileKey?.let { _ -> it.profileKey.or(ByteArray(0)).contentEquals(profileKey) } ?: true
    }

    fun MockKMatcherScope.signalReceiptMessage(
        type: SignalServiceReceiptMessage.Type? = null,
        timestamps: List<Long>? = null,
        id: Long? = null,
    ): SignalServiceReceiptMessage = match {
        // check for equality of each provided param. if param not provided, don't check it!
        type?.let{ _ -> it.type == type } ?: true &&
                timestamps?.let { _ -> it.timestamps == timestamps } ?: true &&
                id?.let { _ -> it.`when` == id } ?: true
    }


    fun MockKMatcherScope.signalExpirationUpdate(
        expiresInSeconds: Int,
    ): SignalServiceDataMessage = match {
        it.isExpirationUpdate && it.expiresInSeconds == expiresInSeconds
    }
}