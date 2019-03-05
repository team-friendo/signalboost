const docker = require('../../../services/orchestrator/docker')
const channelRepository = require('../../../db/repositories/channel')
const phoneNumberRepository = require('../../../db/repositories/phoneNumber')
const { statuses } = require('../../../db/models/phoneNumber')

const activate = async ({ db, phoneNumber, channelName }) => {
  const containerId = await docker.runContainer(phoneNumber, channelName)
  return Promise.all([
    channelRepository.create(db, phoneNumber, channelName, containerId),
    phoneNumberRepository.update(db, phoneNumber, { status: statuses.ACTIVE }),
  ])
}

module.exports = { activate }
