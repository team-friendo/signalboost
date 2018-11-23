const moment = require('moment')
const signal = require('./signalInterface.js')
const { keys, includes } = require('lodash')
// TODO: replace hard-coded recipients with dynamic ones in card #21
const admins = require('../../data/admins.json')
const members = require('../../data/members.json')

const run = () => signal.onReceivedMessage(dispatch)

const dispatch = ({ message, sender, attachments }) =>
  isAdmin(sender)
    ? relayMessage({ message, sender, attachments })
    : sendNotAdminMessage(sender)

const relayMessage = ({ message, sender, attachments }) =>
  signal.sendMessage(
    fmtMsg({ message, sender }),
    keys(members),
    attachments
  ).catch(console.error)

const sendNotAdminMessage = (sender) =>
  signal.sendMessage(notAdminMsg, [sender]).catch(console.error)

// HELPERS

const isAdmin = userNumber => includes(keys(admins), userNumber)
const fmtMsg = ({ message, sender }) => `${message}\n - @${admins[sender]}`

const notAdminMsg =
  'Whoops! You are not an admin for this group. ' +
  'Only admins can send messages. Sorry! :)'

module.exports = { run }
