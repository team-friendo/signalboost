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

// ({ Database, Socket, string, string, Array<string> }) -> Promise<ChannelStatus>
const create = ({ db, sock, phoneNumber, name, publishers }) =>
  signal
    .subscribe(sock, phoneNumber)
    .then(() =>
      Promise.all([
        channelRepository.create(db, phoneNumber, name, publishers),
        phoneNumberRepository.update(db, phoneNumber, { status: statuses.ACTIVE }),
      ]),
    )
    .then(([channel]) =>
      wait(welcomeDelay).then(() =>
        sendWelcomes(db, sock, {
          ...channel.dataValues,
          subscriptions: [],
        }),
      ),
    )
    .then(() => ({ status: statuses.ACTIVE, phoneNumber, name, publishers }))
    .catch(e => {
      logger.error(e)
      return {
        status: statuses.ERROR,
        error: e.message || e,
        request: { phoneNumber, name, publishers },
      }
    })

const sendWelcomes = async (db, sock, channel) =>
  Promise.all(
    channel.publications.map(publication =>
      messenger.welcomeNewPublisher({
        db,
        sock,
        channel,
        newPublisher: publication.publisherPhoneNumber,
        addingPublisher: 'the system administrator',
      }),
    ),
  )

module.exports = { create }
