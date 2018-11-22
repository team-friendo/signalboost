const { getBus } = require('dbus')
const { promisifyCallback } = require('./util.js')

/*****************************************

  NOTE: Signal.SendMessage is overloaded and underdocumented.

  Here are its two implementations:

  (1) message to multiple recipients:
      sendMessage(msg: string, attachments: string[], recipients: string[])

  (2) message to single recipient:
      sendMessage(msg: string, attachments: string[], recipient: string)

  ------------------------------------------

  for futher documentation:

  (a) see /docs/signal_cli_dbbus_interface.xml

  (b) call the following:

   ```js
   systemBus.getInterface(dest, path, "org.freedesktop.DBus.Introspectable", (err, iface) => {
     iface.Introspect(console.log)
   })
   ```

*****************************************/

const systemBus = getBus('system')
const dest = 'org.asamk.Signal'
const interface = dest
const path = '/org/asamk/Signal'

const getInterface = () => (
  new Promise((resolve, reject) => (
    systemBus.getInterface(dest, path, interface, (err, iface) => {
      if (err) reject(err)
      else resolve(iface)
    })
  ))
)

const onReceviedMessage = handleMessage => (
  // need to do something with either generators or streams here...
  getInterface().then(iface => (
    iface.on(
      'MessageReceived',
      (timestamp, sender, _, message, __) => handleMessage({ message, sender, timestamp }))
  ))
)

const sendMessage = (msg, recipients) => (
  getInterface()
    .then(iface => (
      new Promise((resolve, reject) => (
        iface.sendMessage(msg, [], recipients, promisifyCallback(resolve, reject))
      ))
    ))
)

module.exports = { sendMessage, onReceviedMessage }
