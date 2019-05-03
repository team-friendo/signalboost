const { isEmpty } = require('lodash')
const signal = require('./signal')
const channelRepository = require('./../../db/repositories/channel')
const executor = require('./executor')
const messenger = require('./messenger')
const logger = require('./logger')
const { channelPhoneNumber } = require('../../config')

/**
 * type Dispatchable = {
 *   db: SequelizeDatabaseConnection,
 *   sock: Socket,
 *   channel: Channel,
 *   sender: Sender,
 *   message: OutMessage,
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
    // sock.on('data', msg =>
    //   console.log(`++++++\n ${JSON.stringify(JSON.parse(msg), null, ' ')}++++++`),
    // )
    // this is how to register verify...
    // await signal.register(sock, '+14049486063')
    // await signal.verify(sock, '+14049486063', '433-880')
    await signal.subscribe(sock, '+14049486063')
    signal.onReceivedMessage(sock, handleMessage(db, sock))
  })
}

const handleMessage = (db, sock) => async inMessage => {
  if (signal.shouldRelay(inMessage)) {
    const channelPhoneNumber = inMessage.data.username

    const [channel, sender] = await Promise.all([
      channelRepository.findDeep(db, channelPhoneNumber),
      classifySender(db, channelPhoneNumber, inMessage.data.source),
    ]).catch(console.error)

    // TODO: rename 'message' -> 'envelope'
    const message = signal.parseOutMessage(inMessage)
    return messenger
      .dispatch(await executor.processCommand({ db, sock, channel, sender, message }))
      .catch(logger.error)
  }
}

const classifySender = async (db, channelPhoneNumber, sender) => ({
  phoneNumber: sender,
  isPublisher: await channelRepository.isPublisher(db, channelPhoneNumber, sender),
  isSubscriber: await channelRepository.isSubscriber(db, channelPhoneNumber, sender),
})

const initialize = async (db, sock, channelPhoneNumber) => {
  const channel = await channelRepository.findDeep(db, channelPhoneNumber)
  return welcomeNewPublishers(db, sock, channel)
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

// EXPORTS

module.exports = run
