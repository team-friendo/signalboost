const channelRepository = require('../../db/repositories/channel')
const signal = require('./signal')

const messages = {
  NOT_ADMIN:
    'Whoops! You are not an admin for this group. Only admins can send messages. Sorry! :)',
}

const maybeBroadcast = async ({ db, iface, channelPhoneNumber, message, sender, attachments }) => {
  const shouldRelay = await channelRepository.isAdmin(db, channelPhoneNumber, sender)
  return shouldRelay
    ? broadcast({ db, iface, channelPhoneNumber, message, attachments })
    : send(iface, messages.NOT_ADMIN, sender)
}

const broadcast = async ({ db, iface, channelPhoneNumber, message, attachments }) =>
  signal.sendMessage(
    iface,
    message,
    await channelRepository.getSubscriberNumbers(db, channelPhoneNumber),
    attachments,
  )

const send = (iface, msg, recipient) => signal.sendMessage(iface, msg, [recipient])

module.exports = { messages, maybeBroadcast, send }
