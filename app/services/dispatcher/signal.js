const net = require('net')
const signaldSocketPath = '/var/run/signald/signald.sock'
const fs = require('fs-extra')
const { promisifyCallback, wait } = require('../util.js')
const logger = require('./logger')
const {
  signal: { connectionInterval, maxConnectionAttempts },
} = require('../../config')

const getSocket = async (attempts = 0) => {
  logger.log(`connecting to signald...`)
  if (!(await fs.pathExists(signaldSocketPath))) {
    if (attempts > maxConnectionAttempts) {
      logger.log('maximum signald connection attempts exceeded. aborting.')
      process.exit(1)
    } else {
      return wait(connectionInterval).then(() => getSocket(attempts + 1))
    }
  } else {
    logger.log(`connected to signald!`)
    return net.createConnection(signaldSocketPath)
  }
}

const fmt = msg => JSON.stringify(msg) + '\n'

// (DbusInterface, Dispatchable => Promise<any>) -> void
// const onReceivedMessage = iface => handleMessage =>
//   iface.on('MessageReceived', (timestamp, sender, _, message, attachments) =>
//     handleMessage({ message, sender, timestamp, attachments }),
//   )

// (Socket, string, string, Array<string>, Array<string>) -> Promise<void>
const sendMessage = (sock, username, messageBody, recipients, attachments = []) =>
  Promise.all(
    recipients.map(
      recipientNumber =>
        new Promise((resolve, reject) =>
          sock.write(
            fmt({ type: 'send', username, recipientNumber, messageBody }),
            promisifyCallback(resolve, reject),
          ),
        ),
    ),
  )

module.exports = { getSocket, sendMessage }
