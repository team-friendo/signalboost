const { promisifyCallback, wait } = require('../util.js')
const logger = require('./logger')
const {
  dbus: { getBus, connectionInterval, maxConnectionAttempts },
} = require('../../config')

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

const dest = 'org.asamk.Signal'
const interfaceName = dest
const path = '/org/asamk/Signal'
const bus = getBus()

// () => Promise<void>
const getDbusInterface = () =>
  new Promise((resolve, reject) => attemptConnection(resolve, reject, 1, null))

// (fn, fn, number) => void
const attemptConnection = (resolve, reject, attempts) => {
  bus.getInterface(dest, path, interfaceName, (err, iface) => {
    if (err) {
      logger.log(`> failed to connect to dbus after ${attempts} attempts.`)
      if (attempts > maxConnectionAttempts) {
        logger.log('> max dbus connection attempts reached. aborting')
        process.exit(1)
      } else {
        logger.log(`> trying again in ${connectionInterval} millis...`)
        wait(connectionInterval).then(() => attemptConnection(resolve, reject, attempts + 1))
      }
    } else {
      logger.log('> connected to dbus.')
      resolve(iface)
    }
  })
}

// (DbusInterface, Dispatchable => Promise<any>) -> void
const onReceivedMessage = iface => handleMessage =>
  iface.on('MessageReceived', (timestamp, sender, _, message, attachments) =>
    handleMessage({ message, sender, timestamp, attachments }),
  )

// (DbusInterface, string, Array<string>, Array<string>) => Promise<void>
const sendMessage = (iface, msg, recipients, attachments = []) =>
  // NOTE: we *must* send message to each recipient individually
  // else the dbus stream is closed when trying to send attachments
  Promise.all(
    recipients.map(
      recipient =>
        new Promise((resolve, reject) =>
          iface.sendMessage(msg, attachments, [recipient], promisifyCallback(resolve, reject)),
        ),
    ),
  ).catch(err => logger.error(`> Sending message failed: ${err}`))

module.exports = { getDbusInterface, sendMessage, onReceivedMessage }
