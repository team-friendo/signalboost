const Docker = require('dockerode')
const dockerClient = new Docker()
const { projectRoot } = require('../../config')
const { get } = require('lodash')

// string -> Promise<?Container>
const getContainer = phoneNumber =>
  dockerClient
    .listContainers({
      filters: { name: [containerNameOf('signalboost_dispatcher', phoneNumber)] },
    })
    .then(cs => cs[0] || null)

// (string, string) -> Promise<Container>
const getOrCreateContainer = async (phoneNumber, channelName) => {
  const container = await getContainer(phoneNumber)
  return container ? container : createContainer(phoneNumber, channelName)
}

// string -> Promise<Container>
const stopContainer = async phoneNumber =>
  getContainer(phoneNumber).then(container => container && stopContainerById(container.Id))

// HELPERS

// string -> Promise<Container>
const createContainer = (phoneNumber, channelName) =>
  dockerClient
    .createContainer({
      name: containerNameOf('signalboost_dispatcher', phoneNumber),
      Image: 'signalboost',
      Entrypoint: '/signalboost/bin/entrypoint/dispatcher',
      Env: [
        `CHANNEL_PHONE_NUMBER=${phoneNumber}`,
        `CHANNEL_NAME=${channelName}`,
        `NODE_ENV=${process.env.NODE_ENV}`,
        `TWILIO_ACCOUNT_SID=${process.env.TWILIO_ACCOUNT_SID}`,
        `TWILIO_AUTH_TOKEN=${process.env.TWILIO_AUTH_TOKEN}`,
      ],
      HostConfig: {
        AutoRemove: true,
        VolumesFrom: ['signalboost_orchestrator'],
        NetworkMode: 'signalboost_default',
      },
    })
    .then(c => c.start())
    .then(c => ({ ...c, Id: c.id })) // yes... this upstream inconsistency is SUPER ANNOYING!

// string -> Promise<Container>
const stopContainerById = id => dockerClient.getContainer(id).stop()

// string -> string
const containerNameOf = (imageName, phoneNumber) =>
  `${imageName}${phoneNumber ? '_' + phoneNumber.slice(1) : ''}`

// string -> string
const configPathOf = phoneNumber => `${projectRoot}/signal_data/${phoneNumber.slice(1)}`

module.exports = {
  dockerClient,
  getContainer,
  getOrCreateContainer,
  stopContainer,
  containerNameOf,
  configPathOf,
}
