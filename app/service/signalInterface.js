const { getBus } = require('dbus')
const { promisifyCallback } = require('./util.js')

/*****************************************
  For documentation on interface for org.asamk.Signal:
  (1) see /docs/signal_cli_dbbus_interface.xml
  (2) call the following:
   ```js
   systemBus.getInterface(dest, path, "org.freedesktop.DBus.Introspectable", (err, iface) => {
     iface.Introspect(console.log)
   })
   ```
*****************************************/

const systemBus = getBus('system')
const dest = 'org.asamk.Signal'
const interfaceName = dest
const path = '/org/asamk/Signal'

const getInterface = () =>
  new Promise((resolve, reject) =>
    systemBus.getInterface(dest, path, interfaceName, (err, iface) => {
      if (err) reject(err)
      else resolve(iface)
    })
  )

const onReceivedMessage = handleMessage =>
  getInterface().then(iface =>
    iface.on(
      'MessageReceived',
      (timestamp, sender, _, message, attachments) =>
        handleMessage({ message, sender, timestamp, attachments }))
  )

const sendMessage = (msg, recipients, attachments = []) =>
  // NOTE: we *must* send message to each recipient individually
  // or else the dbus stream is closed when trying to send attachments
  getInterface().then(iface =>
    Promise.all(
      recipients.map(recipient =>
        new Promise((resolve, reject) =>
          iface.sendMessage(msg, attachments, [recipient], promisifyCallback(resolve, reject))
        )
      )
    )
  )

module.exports = { sendMessage, onReceivedMessage }
