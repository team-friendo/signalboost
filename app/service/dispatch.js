const signal = require('./signalInterface')
const { channelPhoneNumber } = require('../config')
import channelRepository from './repository/channel'

const run = db =>
  signal.onReceivedMessage(payload => dispatch({ db, channelPhoneNumber, ...payload }))

const messages = {
  added: "You've been added to the channel! Yay!",
  notAdmin: 'Whoops! You are not an admin for this group. Only admins can send messages. Sorry! :)',
}

const dispatch = async ({ db, channelPhoneNumber, message, sender, attachments }) => {
  const shouldRelay = await channelRepository.isAdmin(db, channelPhoneNumber, sender)
  return shouldRelay
    ? relay({ db, channelPhoneNumber, message, attachments })
    : sendNotAdminApology(sender)
}

const relay = async ({ db, channelPhoneNumber, message, attachments }) =>
  signal.sendMessage(
    message,
    await channelRepository.getSubscriberNumbers(db, channelPhoneNumber),
    attachments,
  )

const sendNotAdminApology = sender => signal.sendMessage(messages.notAdmin, [sender])

const sendAddedNotification = sender => signal.sendMessage(messages.added, [sender])

module.exports = { run, dispatch, messages }
