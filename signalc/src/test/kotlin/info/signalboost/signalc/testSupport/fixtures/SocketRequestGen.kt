package info.signalboost.signalc.testSupport.fixtures

import info.signalboost.signalc.model.SocketAddress
import info.signalboost.signalc.model.SocketRequest
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genSocketAddress
import info.signalboost.signalc.testSupport.fixtures.StringGen.genPhrase

object SocketRequestGen {

    fun genSendRequest(
        senderNumber: String = genPhoneNumber(),
        recipientAddress: SocketAddress = genSocketAddress(),
        messageBody: String = genPhrase(),
        withAttachments: Boolean = false
    ) =  SocketRequest.Send(
        username = senderNumber,
        recipientAddress = recipientAddress,
        messageBody= messageBody,
        attachments = if(withAttachments) genAttachments() else emptyList()
    )

    fun genSubscribeRequest(
        username: String = genPhoneNumber()
    ) = SocketRequest.Subscribe(
        username
    )

    private fun genAttachments(): List<SocketRequest.Attachment> = listOf(
        SocketRequest.Attachment(
            filename = "/foo/bar.jpg",
            caption = "baz is really bamming!",
            width = 42,
            height = 42,
        ),
        SocketRequest.Attachment(
            filename = "/bar/foo.jpg",
            caption = "bam is really bazzing!",
            width = 24,
            height = 24,
        )
    )
}