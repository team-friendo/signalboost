package info.signalboost.signalc.serialization

import info.signalboost.signalc.serialization.EnvelopeSerializer.toByteArray
import info.signalboost.signalc.serialization.EnvelopeSerializer.toSignalServiceEnvelope
import info.signalboost.signalc.testSupport.dataGenerators.EnvelopeGen.genEnvelope
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe

class EnvelopeSerializerTest: FreeSpec({

    val original = genEnvelope()
    val serialized = original.toByteArray()
    val deserialized = serialized.toSignalServiceEnvelope(original.serverDeliveredTimestamp)
    val reserialized = deserialized.toByteArray()

    "serializes a signal envelope" {
        reserialized shouldBe serialized
    }

    "deserializes a signal envelope" {
        deserialized.type shouldBe original.type
        deserialized.sourceE164 shouldBe original.sourceE164
        deserialized.sourceUuid shouldBe original.sourceUuid
        deserialized.sourceDevice shouldBe original.sourceDevice
        deserialized.timestamp shouldBe original.timestamp
        deserialized.legacyMessage shouldBe original.legacyMessage
        deserialized.content shouldBe original.content
        deserialized.serverReceivedTimestamp shouldBe original.serverReceivedTimestamp
        deserialized.serverDeliveredTimestamp shouldBe original.serverDeliveredTimestamp
        deserialized.uuid shouldBe original.uuid
    }
})