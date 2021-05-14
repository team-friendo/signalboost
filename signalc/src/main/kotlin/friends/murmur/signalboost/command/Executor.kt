package friends.murmur.signalboost.command

import friends.murmur.signalboost.model.*
import info.signalboost.signalc.model.SocketRequest

class Executor(val app: Application) {
    fun execute(executable: Executable, dispatchable: Dispatchable): CommandResult {
        val (command, payload, language) = executable
        val(channel, sender, scMessage) = dispatchable

        return when(command) {
            Command.BROADCAST -> broadcast(channel, sender, scMessage, payload)
            else -> TODO("Not implemented yet!")
        }
    }

    private fun broadcast(channel: Channel, sender: Membership, scMessage: SignalcMessage, payload: String) = CommandResult(
        status = "SUCCESS",
        command = Command.BROADCAST,
        payload = payload,
        message = "",
        notifications = broadcastNotificationsOf(channel, sender, scMessage.attachments, payload),
    )

    private fun broadcastNotificationsOf(
        channel: Channel,
        sender: Membership,
        attachments: List<SocketRequest.Send.Attachment>,
        body: String): List<Notification>
    {
        val adminNotifications = channel.adminMemberships.map {
            Notification(
                recipient = it.memberPhoneNumber,
                message = appendHeaderToRelayableMessage(
                    sender,
                    it,
                    "broadcastMessage",
                    body,
                ),
                attachments = attachments,
            )
        }

        val subscriberNotifications = channel.subscriberMemberships.map {
            Notification(
                recipient = it.memberPhoneNumber,
                message = body,
                attachments = attachments,
            )
        }

        return adminNotifications + subscriberNotifications
    }

    private fun appendHeaderToRelayableMessage(sender: Membership, recipient: Membership, notificationKey: String, body: String): String {
        // TODO
        return body // lol
    }
}