package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.model.SerializableAddress
import info.signalboost.signalc.model.SocketRequest
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genSerializableAddress
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genUuidStr
import info.signalboost.signalc.testSupport.fixtures.StringGen.genFingerprint
import info.signalboost.signalc.testSupport.fixtures.StringGen.genPhrase

object SocketRequestGen {

    fun genAbortRequest() = SocketRequest.Abort(genUuidStr())

    fun genCloseRequest() = SocketRequest.Close(genUuidStr())

    fun genSendRequest(
        senderNumber: String = genPhoneNumber(),
        recipientAddress: SerializableAddress = genSerializableAddress(),
        messageBody: String = genPhrase(),
        withAttachments: Boolean = false
    ) =  SocketRequest.Send(
        id = genUuidStr(),
        username = senderNumber,
        recipientAddress = recipientAddress,
        messageBody= messageBody,
        attachments = if(withAttachments) genAttachments() else emptyList()
    )

    fun genSubscribeRequest(
        username: String = genPhoneNumber()
    ) = SocketRequest.Subscribe(
        id = genUuidStr(),
        username
    )

    fun genTrustRequest(
        id: String = genUuidStr(),
        username: String = genPhoneNumber(),
        recipientAddress: SerializableAddress = genSerializableAddress(),
        fingerprint: String = genFingerprint()
    ) = SocketRequest.Trust(
        id,
        username,
        recipientAddress,
        fingerprint,
    )

    private fun genAttachments(): List<SocketRequest.Send.Attachment> = listOf(
        SocketRequest.Send.Attachment(
            filename = "/foo/bar.jpg",
            caption = "baz is really bamming!",
            width = 42,
            height = 42,
        ),
        SocketRequest.Send.Attachment(
            filename = "/bar/foo.jpg",
            caption = "bam is really bazzing!",
            width = 24,
            height = 24,
        )
    )
}