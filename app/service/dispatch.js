const moment = require('moment')
const signal = require('./signalInterface.js')
const { isAdmin, getMemberNumbers } = require('../service/people.js')

const run = () => signal.onReceivedMessage(dispatch)

const dispatch = ({ message, sender, attachments }) =>
  isAdmin(sender)
    ? relayMessage({ message, sender, attachments })
    : sendNotAdminMessage(sender)

const relayMessage = ({ message, sender, attachments }) =>
  signal.sendMessage(
    message,
    getMemberNumbers(),
    attachments
  ).catch(console.error)

const sendNotAdminMessage = (sender) =>
  signal.sendMessage(notAdminMsg, [sender]).catch(console.error)

const notAdminMsg =
  'Whoops! You are not an admin for this group. ' +
  'Only admins can send messages. Sorry! :)'

module.exports = { run }
