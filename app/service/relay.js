const util = require('util')
const exec = util.promisify(require('child_process').exec)

const relay =(msg, recipients) =>
  exec(`signal-cli --dbus-system send -m "${msg}" ${fmtRecipients(recipients)}`)
    .then(() => `--- SUCCESS: Relayed message "${msg}" to [${recipients}]`)
    .catch(err => console.error(`--- TRANSMISSION ERROR: ${err}`))

const fmtRecipients = recipients =>
  recipients.map(r => `"${r}"`).join(" ")

module.exports = relay

