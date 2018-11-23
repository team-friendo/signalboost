const moment = require('moment')
const { sendMessage, onReceviedMessage } = require('./signalDbusInterface.js')
const { keys, includes } = require('lodash')
// TODO: replace hard-coded recipients with dynamic ones in card #
const admins = require('../../data/admins.json')
const members = require('../../data/members.json')

const run = () => onReceviedMessage(handle)

const handle = ({ message, sender, timestamp, attachments }) =>
  isAdmin(sender)
    ? sendRelayMessage({ message, sender, timestamp, attachments })
    : sendNotAdminMessage(sender)

const sendRelayMessage = ({ message, sender, timestamp, attachments }) =>
  sendMessage(
    fmtMsg({ message, sender, timestamp }),
    keys(members),
    attachments
  ).catch(console.error)

const sendNotAdminMessage = (sender) =>
  sendMessage(notAdminMsg, [sender]).catch(console.error)

// TODO: implement admin filter to close card #20
const isAdmin = userNumber => includes(keys(admins), userNumber)

const fmtMsg = ({ message, sender, timestamp}) => `${message}\n - @${admins[sender]}`


const hourOf = ts => moment(ts).format('h:mma')
const dateOf = ts => moment(ts).format('M/D')
const timezone = () => ({
  '-0800': 'PST',
  '-0700': 'MST',
  '-0600': 'CST',
  '-0500': 'EST',
}[moment().format('ZZ')])

const notAdminMsg =
  'Whoops! You are not an admin for this group. ' +
  'Only admins can send messages. Sorry! :)'

module.exports = { run }
