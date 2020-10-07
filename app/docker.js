const Docker = require('dockerode')
const dockerClient = new Docker()

const projectRoot = process.env.SIGNALBOOST_PROJECT_ROOT

const containerTypes = {
  SIGNALD: 'SIGNALD',
}

const containerNames = {
  SIGNALD: 'signalboost_signald',
}

const images = {
  SIGNALD: 'registry.0xacab.org/team-friendo/signalboost/signald',
}

// string -> Promise<Container>
const startContainer = async containerType => {
  const container = await dockerClient.createContainer({
    name: containerNames[containerType],
    Image: images[containerType],
    // EnvFile: '.env.dev', // TODO: switch off of env for this
    Env: [
      `SIGNALD_VERBOSE_LOG: ${process.env.SIGNALD_VERBOSE_LOG || 0}}`,
      // TODO: prod env vars
    ],
    // see docker api for how to get this just right:
    // https://docs.docker.com/engine/api/v1.40/#operation/ContainerCreate
    // ExposedPorts: {
    //   '1312': {},
    // },
    // Ports: [
    //   {
    //     PrivatePort: '9010',
    //     PublicPort: '9010',
    //     Type: 'tcp',
    //   },
    // ],
    Volumes: {
      '/var/lib/signald/data': {},
      '/var/run/signald/': {},
    },
    HostConfig: {
      AutoRemove: true,
      NetworkMode: 'default',
      // NetworkMode: 'localdev',
      Binds: [
        `${projectRoot}/bin:/signalboost/bin`,
        `${projectRoot}/signald/jmx:/var/lib/jmx`,
        'signalboost_signal_data:/var/lib/signald/data:rw',
        'signalboost_signal_sock:/var/run/signald:rw',
      ],
    },
  })
  await container.start()
  return { ...container, Id: container.id } // yes... this upstream inconsistency is SUPER ANNOYING!
}
// string -> Promise<?Container>
const getContainer = async containerType => {
  const matchingContainers = await dockerClient.listContainers({
    filters: { name: [containerNames[containerType]] },
  })
  return matchingContainers[0] || null
}

// string -> Promise<Container>
const stopContainer = async containerType => {
  const containerId = (await getContainer(containerType))['Id']
  if (!containerId) return null
  const container = dockerClient.getContainer(containerId)
  await container.stop()
  return container.remove()
}

// string -> Promise<Container>
module.exports = {
  dockerClient,
  getContainer,
  startContainer,
  stopContainer,
  containerTypes,
}
