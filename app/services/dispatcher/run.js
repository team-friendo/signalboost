const signal = require('./signal')
const channelRepository = require('./../../db/repositories/channel')
const executor = require('./executor')
const messenger = require('./messenger')
const logger = require('./logger')
const { channelPhoneNumber } = require('../../config')

/**
 * type Dispatchable = {
 *   db: SequelizeDatabaseConnection,
 *   iface: DbusInterface,
 *   channel: Channel,
 *   sender: Sender,
 *   message: string,
 *   attachments: string,
 * }
 */

/**
 * type Channel = {
 *   phoneNumber: string,
 *   name: string,
 *   (containerId: string,)
 * }
 */

/**
 * type Sender = {
 *   phoneNumber: string,
 *   isAdmin: boolean,
 *   isSubscriber: boolean,
 * }
 */

/**
 * type CommandResult = {
 *   status: string
 *   message: string,
 * }
 */

// MAIN FUNCTIONS

const run = async db => {
  const iface = await signal.getDbusInterface()

  logger.log(`Dispatcher listening on channel: ${channelPhoneNumber}...`)
  signal.onReceivedMessage(iface)(payload => handleMessage(db, iface, payload).catch(logger.error))
}

const handleMessage = async (db, iface, payload) => {
  logger.log(`Dispatching message on channel: ${channelPhoneNumber}`)
  const [channel, sender] = await Promise.all([
    channelRepository.findDeep(db, channelPhoneNumber),
    authenticateSender(db, channelPhoneNumber, payload.sender),
  ])
  return messenger.dispatch(
    await executor.processCommand({ ...payload, db, iface, channel, sender }),
  )
}

const authenticateSender = async (db, channelPhoneNumber, sender) => ({
  phoneNumber: sender,
  isAdmin: await channelRepository.isAdmin(db, channelPhoneNumber, sender),
  isSubscriber: await channelRepository.isSubscriber(db, channelPhoneNumber, sender),
})

// EXPORTS

module.exports = run
