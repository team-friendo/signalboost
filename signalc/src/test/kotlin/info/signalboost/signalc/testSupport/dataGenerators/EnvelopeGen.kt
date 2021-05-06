package info.signalboost.signalc.testSupport.dataGenerators

import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genSignalServiceAddress
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genInt
import info.signalboost.signalc.testSupport.dataGenerators.NumGen.genLong
import info.signalboost.signalc.testSupport.dataGenerators.StringGen.genPhrase
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.CIPHERTEXT_VALUE


object EnvelopeGen {
    fun genEnvelope(
        type: Int = CIPHERTEXT_VALUE,
        sender: SignalServiceAddress = genSignalServiceAddress(),
        senderDevice: Int = genInt(),
        timestamp: Long = genLong(),
        legacyMessage: ByteArray = genPhrase().toByteArray(),
        content: ByteArray = genPhrase().toByteArray(),
        serverReceivedTimestamp: Long = genLong(),
        serverDeliveredTimestamp: Long = genLong(),
        uuid: String = genUuidStr(),
    ): SignalServiceEnvelope = SignalServiceEnvelope(
       type,
       Optional.of(sender),
       senderDevice,
       timestamp,
       legacyMessage,
       content,
       serverReceivedTimestamp,
       serverDeliveredTimestamp,
       uuid,
    )
}