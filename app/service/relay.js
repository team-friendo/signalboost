const moment = require('moment')
const { sendMessage, onReceviedMessage } = require('./signalDbusInterface.js')
const { keys, includes } = require('lodash')
// TODO: replace hard-coded recipients with dynamic ones in card #
const admins = require('../../data/admins.json')
const members = require('../../data/members.json')

const run = () => onReceviedMessage(relay)

const relay = ({ message, sender, timestamp}) =>
  isAdmin(sender)
    ? sendMessage(fmtMsg({ message, sender, timestamp }), keys(members)).catch(console.error)
    : sendMessage(notAdminMsg, [sender]).catch(console.error)

// TODO: implement admin filter to close card #20
const isAdmin = userNumber => includes(keys(admins), userNumber)

const fmtMsg = ({ message, sender, timestamp}) =>
  `"${message}" \n ` +
    `-- FROM: ${admins[sender]} \n` +
      `-- AT: ${moment(timestamp).format('h:mm a (MM/DD/YY)')}`

const notAdminMsg =
  'Whoops! You are not an admin for this group. ' +
  'Only admins can send messages. Sorry! :)'

module.exports = { run }
