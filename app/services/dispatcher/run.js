const { get } = require('lodash')
const signal = require('../signal')
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
 *
 * type Sender = {
 *   phoneNumber: string,
 *   isPublisher: boolean,
 *   isSubscriber: boolean,
 * }
 *
 * type CommandResult = {
 *   status: string,
 *   command: string,
 *   message: string,
 * }
 */

// INITIALIZATION

const run = async (db, sock) => {
  logger.log('--- Initializing Dispatcher....')

  // for debugging...
  // sock.on('data', data => console.log(`+++++++++\n${data}\n++++++++\n`))

  logger.log(`----- Subscribing to channels...`)
  const channels = await channelRepository.findAllDeep(db).catch(logger.fatalError)
  const listening = await listenForInboundMessages(db, sock, channels).catch(logger.fatalError)
  logger.log(`----- Subscribed to ${listening.length} of ${channels.length} channels!`)

  logger.log(`--- Dispatcher running!`)
}

const listenForInboundMessages = async (db, sock, channels) =>
  Promise.all(channels.map(ch => signal.subscribe(sock, ch.phoneNumber))).then(listening => {
    sock.on('data', inboundMsg => dispatch(db, sock, parseMessage(inboundMsg)))
    return listening
  })

// MESSAGE DISPATCH

const dispatch = async (db, sock, inboundMsg) => {
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

const parseMessage = inboundMsg => {
  try {
    return JSON.parse(inboundMsg)
  } catch (e) {
    return inboundMsg
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

module.exports = { run }
