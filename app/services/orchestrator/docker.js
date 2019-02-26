const Docker = require('dockerode')
const dockerClient = new Docker()
const imageName = 'signalboost_dispatcher'
const { projectRoot } = require('../../config')

// TODO: use named volumes for logs (instead of copying directories in

// string -> Promise<Container>
const runContainer = phoneNumber =>
  dockerClient
    .createContainer({
      name: containerNameOf(phoneNumber),
      Image: imageName,
      Env: [
        `CHANNEL_PHONE_NUMBER=${phoneNumber}`,
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

// string -> Promise<Container>
const stopContainer = id => dockerClient.getContainer(id).stop()

// string -> string
const containerNameOf = phoneNumber => `${imageName}_${phoneNumber.slice(1)}`

module.exports = { runContainer, stopContainer }
