const docker = require('../docker')
const channelRepository = require('../../../db/repositories/channel')
const phoneNumberRepository = require('../../../db/repositories/phoneNumber')
const { statuses } = require('../../../db/models/phoneNumber')

// (Database, Array<ChannelAttributes>) -> Promise<Array<ChannelStatus>>
const activateMany = (db, channelAttrs) =>
  Promise.all(channelAttrs.map(({ phoneNumber, name }) => activate({ db, phoneNumber, name })))

// ({ Database, String, String }) -> Promise<ChannelStatus>
const activate = async ({ db, phoneNumber, name, publishers }) => {
  try {
    const { Id: containerId } = await docker.getOrCreateContainer(phoneNumber, name)
    await channelRepository.activate(db, phoneNumber, name, containerId)
    await channelRepository.addPublishers(db, phoneNumber, publishers)
    return {
      ...(await phoneNumberRepository
        .update(db, phoneNumber, { status: statuses.ACTIVE })
        .then(x => x.dataValues)),
      name,
      publishers,
    }
  } catch (error) {
    return { status: statuses.ERROR, error, request: { phoneNumber, name, publishers } }
  }
}

module.exports = { activate, activateMany }
