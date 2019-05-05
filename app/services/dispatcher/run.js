const { get, isEmpty } = require('lodash')
const signal = require('../signal')
const dbWrapper = require('../../db')
const channelRepository = require('./../../db/repositories/channel')
const executor = require('./executor')
const messenger = require('./messenger')
const logger = require('./logger')

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

// MAIN FUNCTION

const run = async db => {
  logger.log('Connecting to database...')
  await dbWrapper.getDbConnection(db).catch(logger.fatalError)
  logger.log('Connected to database!')

  logger.log('Connecting to signald socket...')
  const sock = await signal.getSocket().catch(logger.fatalError)
  logger.log('Connected to signald socket!')

  // TODO: remove this (and decommission numbers) once orchestrator#initialize is implemented!
  // await signal.subscribe(sock, '+13125842388')
  // await signal.subscribe(sock, '+14049486063')

  await initialize(db, sock)
  logger.log(`Dispatcher running!`)

  // this is how to register/verify/activate...
  // await signal.register(sock, '+14049486063')
  // await signal.verify(sock, '+14049486063', '523-975')
  // await signal.subscribe(sock, '+14049486063')
}

// INITIALIZATION

const initialize = async (db, sock) => {
  const channels = await channelRepository.findAllDeep(db)
  await welcomeNewChannels(db, sock, channels)
  return listenForInboundMessages(db, sock, channels)
}

const welcomeNewChannels = (db, sock, channels) =>
  Promise.all(channels.map(ch => welcomeNewChannel(db, sock, ch)))

const welcomeNewChannel = async (db, sock, channel) => {
  const unwelcomed = await channelRepository.getUnwelcomedPublishers(db, channel.phoneNumber)
  const addingPublisher = 'the system administrator'

  !isEmpty(unwelcomed) &&
    logger.log(`Welcoming ${unwelcomed.length} new publisher(s) on ${channel.name}...`)
  return Promise.all(
    unwelcomed.map(newPublisher =>
      messenger.welcomeNewPublisher({ db, sock, channel, newPublisher, addingPublisher }),
    ),
  )
}

const listenForInboundMessages = (db, sock, channels) => {
  logger.log(`Dispatcher listening for messages on ${channels.length} channels...`)
  sock.on('data', inboundMsg => dispatch(db, sock, JSON.parse(inboundMsg)))
  return Promise.resolve()
}

// MESSAGE DISPATCH

const dispatch = async (db, sock, inboundMsg) => {
  // for debugging:
  // console.log(`++++++++\n${JSON.stringify(inboundMsg, null, '  ')}\n+++++++++`)
  if (shouldRelay(inboundMsg)) {
    const channelPhoneNumber = inboundMsg.data.username
    const sdMessage = signal.parseOutboundSdMessage(inboundMsg)
    try {
      const [channel, sender] = await Promise.all([
        channelRepository.findDeep(db, channelPhoneNumber),
        classifySender(db, channelPhoneNumber, inboundMsg.data.source),
      ])
      return messenger.dispatch(
        await executor.processCommand({ db, sock, channel, sender, sdMessage }),
      )
    } catch (e) {
      logger.error(e)
    }
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
