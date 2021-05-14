package friends.murmur.signalboost.model

import info.signalboost.signalc.model.SignalcAddress
import info.signalboost.signalc.model.SocketRequest


enum class Language(asString: String) {
    EN("EN"),
    ES("ES"),
    FR("FR"),
    DE("DE"),
}

enum class MemberType {
    ADMIN,
    SUBSCRIBER,
    NONE
}

data class Channel(
    val memberships: List<Membership>,
) {
   val adminMemberships: List<Membership>
     get() = memberships.filter { it.type == MemberType.ADMIN }
    val subscriberMemberships: List<Membership>
        get() = memberships.filter { it.type == MemberType.SUBSCRIBER }
}

data class Membership(
    val type: MemberType,
    val channelPhoneNumber: String,
    val memberPhoneNumber: String,
    val language: Language,
)

data class SignalcMessage(
    val type: String = "SEND",
    val username: String,
    val recipientAddress: SignalcAddress,
    val messageBody: String,
    val attachments: List<SocketRequest.Send.Attachment>,
    val expiresInSeconds: Int,
)

data class Dispatchable(
    val channel: Channel,
    val sender: Membership,
    val message: SignalcMessage,
)

data class Executable(
    val command: Command,
    val paylod: String,
    val language: Language,
)



data class SignalboostResult(
    val status: String,
    val message: String,
)

data class Notification(
    val recipient: String,
    val message: String,
    val attachments: List<SocketRequest.Send.Attachment>,
)

data class CommandResult(
    val command: Command,
    val payload: String,
    val status: String,
    val message: String,
    val notifications: List<Notification>,
)

enum class Command(val asString: String) {
    BROADCAST("BROADCAST")
}


class Application
