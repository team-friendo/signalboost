import { messagesIn } from '../../dispatcher/messages'
import { defaultLanguage } from '../../../config'

const channelRepository = require('../../../db/repositories/channel')
const phoneNumberRepository = require('../../../db/repositories/phoneNumber')
const signal = require('../../signal')
const messenger = require('../../dispatcher/messenger')
const { statuses } = require('../../../db/models/phoneNumber')
const { loggerOf, wait } = require('../../util')
const logger = loggerOf()
const {
  signal: { welcomeDelay },
} = require('../../../config')

const welcomeNotification = messagesIn(defaultLanguage).notifications.welcome('the system admin')

// ({ Database, Socket, string, string, Array<string> }) -> Promise<ChannelStatus>
const create = async ({ db, sock, phoneNumber, name, publishers }) => {
  try {
    await signal.subscribe(sock, phoneNumber)
    const channel = await channelRepository.create(db, phoneNumber, name, publishers)
    await phoneNumberRepository.update(db, phoneNumber, { status: statuses.ACTIVE })
    await wait(welcomeDelay)
    await messenger.notify({
      db,
      sock,
      channel,
      notification: welcomeNotification,
      recipients: channel.publications.map(p => p.publisherPhoneNumber),
    })
    return { status: statuses.ACTIVE, phoneNumber, name, publishers }
  } catch (e) {
    logger.error(e)
    return {
      status: statuses.ERROR,
      error: e.message || e,
      request: { phoneNumber, name, publishers },
    }
  }
}

// ({ Database, Socket, string, string }) -> Promise<SignalboostStatus>
const addPublisher = async ({ db, sock, channelPhoneNumber, publisherPhoneNumber }) => {
  await channelRepository.addPublisher(db, channelPhoneNumber, publisherPhoneNumber)
  return messenger.notify({
    db,
    sock,
    channel: { phoneNumber: channelPhoneNumber },
    notification: welcomeNotification,
    recipients: [publisherPhoneNumber],
  })
}

module.exports = { welcomeNotification, create, addPublisher }
