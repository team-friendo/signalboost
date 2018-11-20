const util = require('util')
const exec = util.promisify(require('child_process').exec)
const { dest, path, methods } = require('../constants/signalDbusInterface.js')

// TODO: use dbus-native instead of calling shell command
const relay =(msg, recipients) =>
  exec(`dbus-send --system --type=method_call --print-reply --dest="${dest}" ${path} ${methods.sendMessage} string:'${msg}' array:string: array:string:${fmt(recipients)}`)
    .then(() => `--- SUCCESS: Relayed message "${msg}" to [${recipients}]`)
    .catch(err => console.error(`--- TRANSMISSION ERROR: ${err}`))

/************************************************
 if we handled the result in the `then` block of `relay`,
 we would have access to the following (returned by org.asamk.Signal.sendMessage):
 - method_return_time: float
 - sender: float
 - destination: float
 - seriai: int
 - reply_serial: int
*****************************************/    

const fmt = recipients =>
  recipients.map(r => `"${r}"`).join(',')

module.exports = relay
