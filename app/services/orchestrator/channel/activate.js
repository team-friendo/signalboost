const docker = require('../docker')
const channelRepository = require('../../../db/repositories/channel')
const phoneNumberRepository = require('../../../db/repositories/phoneNumber')
const { statuses } = require('../../../db/models/phoneNumber')

/*
 * type ChannelStatus = {
 *   status: enum [PURCHASED, REGISTERED, VERIFIED, ACTIVE, ERROR]
 *   name: string,
 *   phoneNumber: string,
 *   admins: Array<string>,
 *   error: ?string,
 * }
 */

// (Database, Array<ChannelAttributes>) -> Promise<Array<ChannelStatus>>
const activateMany = (db, channelAttrs) =>
  Promise.all(channelAttrs.map(({ phoneNumber, name }) => activate({ db, phoneNumber, name })))

// ({ Database, String, String }) -> Promise<ChannelStatus>
const activate = async ({ db, phoneNumber, name, admins }) => {
  try {
    const { Id: containerId } = await docker.getOrCreateContainer(phoneNumber, name)
    await channelRepository.updateOrCreate(db, phoneNumber, name, containerId)
    await channelRepository.addAdmins(db, phoneNumber, admins)
    return {
      ...(await phoneNumberRepository
        .update(db, phoneNumber, { status: statuses.ACTIVE })
        .then(x => x.dataValues)),
      name,
      admins,
    }
  } catch (error) {
    return { status: statuses.ERROR, error }
  }
}

module.exports = { activate, activateMany }
