const util = require('util')
const exec = util.promisify(require('child_process').exec)

// const service = "dbus-org.asamk.Signal.service"
const destination = "org.asamk.Signal"

//TODO: use dbus-native instead of calling shell command
const relay =(msg, recipients) =>
  exec(`dbus-send --system --type=method_call --print-reply --dest="org.asamk.Signal" /org/asamk/Signal org.asamk.Signal.sendMessage string:'${msg}' array:string: string:'${recipients[0]}'`)
    .then(() => `--- SUCCESS: Relayed message "${msg}" to [${recipients}]`)
    .catch(err => console.error(`--- TRANSMISSION ERROR: ${err}`))

const fmtRecipients = recipients =>
  recipients.map(r => `"${r}"`).join(" ")

module.exports = relay
