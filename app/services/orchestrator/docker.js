const Docker = require('dockerode')
const dockerClient = new Docker()
const { projectRoot } = require('../../config')

// TODO: use named volumes for logs?

// string -> Promise<String>
const runContainer = (phoneNumber, channelName) =>
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
    .then(c => c.id)

// string -> Promise<Container>
const stopContainer = id => dockerClient.getContainer(id).stop()

// string -> string
const containerNameOf = (imageName, phoneNumber) =>
  `${imageName}${phoneNumber ? '_' + phoneNumber.slice(1) : ''}`

// string -> string
const configPathOf = phoneNumber => `${projectRoot}/signal_data/${phoneNumber.slice(1)}`

module.exports = { dockerClient, runContainer, stopContainer, containerNameOf, configPathOf }
