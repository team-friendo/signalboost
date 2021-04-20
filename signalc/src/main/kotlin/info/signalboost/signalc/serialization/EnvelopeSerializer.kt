package info.signalboost.signalc.serialization

import com.google.protobuf.ByteString
import info.signalboost.signalc.db.Envelopes
import org.jetbrains.exposed.sql.ResultRow
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.internal.push.SignalServiceProtos

object EnvelopeSerializer {

    fun ByteArray.toSignalServiceEnvelope(serverDeliveredTimestamp: Long): SignalServiceEnvelope =
        SignalServiceEnvelope(this, serverDeliveredTimestamp)

    fun SignalServiceEnvelope.toByteArray(): ByteArray =
        SignalServiceProtos.Envelope
            .newBuilder()
            .setType(SignalServiceProtos.Envelope.Type.forNumber(this.type))
            .let {
                if (this.sourceE164.isPresent) it.setSourceE164(this.sourceE164.get())
                else it
            }
            .let {
                if (this.sourceUuid.isPresent) it.setSourceUuid(this.sourceUuid.get())
                else it
            }
            .setSourceDevice(this.sourceDevice)
            .setTimestamp(this.timestamp)
            .setLegacyMessage(ByteString.copyFrom(this.legacyMessage))
            .setContent(ByteString.copyFrom(this.content))
            .setServerTimestamp(this.serverReceivedTimestamp)
            .setServerGuid(this.uuid)
            .build()
            .toByteArray()

    fun ResultRow.toEnvelope(): SignalServiceEnvelope =
        this[Envelopes.envelopeBytes].toSignalServiceEnvelope(this[Envelopes.serverDeliveredTimestamp])
}
