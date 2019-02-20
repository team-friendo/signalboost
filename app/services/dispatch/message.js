const channelRepository = require('../../db/repositories/channel')
const signal = require('./signalInterface')

const messages = {
  NOT_ADMIN:
    'Whoops! You are not an admin for this group. Only admins can send messages. Sorry! :)',
}

const maybeBroadcast = async ({ db, channelPhoneNumber, message, sender, attachments }) => {
  const shouldRelay = await channelRepository.isAdmin(db, channelPhoneNumber, sender)
  return shouldRelay
    ? broadcast({ db, channelPhoneNumber, message, attachments })
    : send(messages.NOT_ADMIN, sender)
}

const broadcast = async ({ db, channelPhoneNumber, message, attachments }) =>
  signal.sendMessage(
    message,
    await channelRepository.getSubscriberNumbers(db, channelPhoneNumber),
    attachments,
  )

const send = (msg, recipient) => signal.sendMessage(msg, [recipient])

module.exports = { messages, maybeBroadcast, send }
