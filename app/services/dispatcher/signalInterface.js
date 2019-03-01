const { promisifyCallback, wait } = require('../util.js')
const { dbus } = require('../../config')

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

const bus = dbus.getBus()
const dest = 'org.asamk.Signal'
const interfaceName = dest
const path = '/org/asamk/Signal'

const getInterface = async () => {
  return new Promise((resolve, reject) =>
    bus.getInterface(dest, path, interfaceName, (err, iface) => {
      // TODO: add retry logic here (for startup)?
      if (err) reject(err)
      else resolve(iface)
    }),
  )
}

// Function[Dispatchable => Promise<any>] => void
const onReceivedMessage = handleMessage =>
  getInterface()
    .then(iface =>
      iface.on('MessageReceived', (timestamp, sender, _, message, attachments) =>
        handleMessage({ message, sender, timestamp, attachments }),
      ),
    )
    .catch(err => console.error(`> Handling message failed: ${err}`))

const sendMessage = (msg, recipients, attachments = []) =>
  // NOTE: we *must* send message to each recipient individually
  // or else the dbus stream is closed when trying to send attachments
  getInterface()
    .then(iface =>
      Promise.all(
        recipients.map(
          recipient =>
            new Promise((resolve, reject) =>
              iface.sendMessage(msg, attachments, [recipient], promisifyCallback(resolve, reject)),
            ),
        ),
      ),
    )
    .catch(err => console.error(`> Sending message failed: ${err}`))

module.exports = { sendMessage, onReceivedMessage }
