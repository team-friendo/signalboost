const { get, isEmpty } = require('lodash')
const signal = require('../signal')
const channelRepository = require('./../../db/repositories/channel')
const executor = require('./executor')
const messenger = require('./messenger')
const logger = require('./logger')

const { channelPhoneNumber } = require('../../config')

/**
 * type Dispatchable = {
 *   db: SequelizeDatabaseConnection,
 *   sock: Socket,
 *   channel: models.Channel,
 *   sender: Sender,
 *   sdMessage: signal.OutBoundSignaldMessage,,
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
 *   isPublisher: boolean,
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

// const oldRun = async db => {
//   const iface = await signal.getDbusInterface()
//
//   logger.log(`Dispatcher listening on channel: ${channelPhoneNumber}...`)
//   signal.onReceivedMessage(iface)(payload => handleMessage(db, iface, payload).catch(logger.error))
//
//   logger.log(`Initializing Dispatcher...`)
//   await initialize(db, iface, channelPhoneNumber).catch(e =>
//     logger.error(`Error Initializing Dispatcher: ${e}`),
//   )
//   logger.log(`Dispatcher initialized!`)
// }

const run = async db => {
  const sock = await signal.getSocket()
  sock.setEncoding('utf8')
  sock.on('connect', async () => {
    // this is how to register/verify/activate...
    // await signal.register(sock, '+14049486063')
    // await signal.verify(sock, '+14049486063', '433-880')
    // await signal.subscribe(sock, '+14049486063')

    await initialize(db, sock)
    sock.on('data', inboundMsg => dispatch(db, sock, JSON.parse(inboundMsg)))
  })
}

// INITIALIZATION

const initialize = async (db, sock) => {
  const channels = await channelRepository.findAllDeep(db)
  return Promise.all(channels.map(ch => welcomeNewPublishers(db, sock, ch)))
}

const welcomeNewPublishers = async (db, sock, channel) => {
  const unwelcomed = await channelRepository.getUnwelcomedPublishers(db, channelPhoneNumber)
  const addingPublisher = 'the system administrator'

  isEmpty(unwelcomed)
    ? logger.log('No new publishers to welcome.')
    : logger.log(`Sending welcome messages to ${unwelcomed.length} new publisher(s)...`)

  return Promise.all(
    unwelcomed.map(newPublisher =>
      messenger.welcomeNewPublisher({ db, sock, channel, newPublisher, addingPublisher }),
    ),
  )
}

// MESSAGE DISPATCH

const dispatch = async (db, sock, inboundMsg) => {
  if (shouldRelay(inboundMsg)) {
    const channelPhoneNumber = inboundMsg.data.username

    const [channel, sender] = await Promise.all([
      channelRepository.findDeep(db, channelPhoneNumber),
      classifySender(db, channelPhoneNumber, inboundMsg.data.source),
    ]).catch(logger.error)

    const sdMessage = signal.parseOutboundSdMessage(inboundMsg)

    return messenger
      .dispatch(await executor.processCommand({ db, sock, channel, sender, sdMessage }))
      .catch(logger.error)
  }
}

const shouldRelay = sdMessage =>
  sdMessage.type === signal.messageTypes.MESSAGE && get(sdMessage, 'data.dataMessage')

const classifySender = async (db, channelPhoneNumber, sender) => ({
  phoneNumber: sender,
  isPublisher: await channelRepository.isPublisher(db, channelPhoneNumber, sender),
  isSubscriber: await channelRepository.isSubscriber(db, channelPhoneNumber, sender),
})

// EXPORTS

module.exports = run
