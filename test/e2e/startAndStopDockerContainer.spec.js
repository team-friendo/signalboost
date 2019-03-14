import { expect } from 'chai'
import { describe, it, before } from 'mocha'
import {
  dockerClient,
  getContainer,
  getOrCreateContainer,
  stopContainer,
} from '../../app/services/orchestrator/docker'

/************************************************************************
 * NOTE: orchestrator container must be running for these tests to pass!
 ************************************************************************/

describe('using the docker client api', () => {
  const phoneNumber = '+15555555555'
  const containerName = 'signalboost_dispatcher_15555555555'
  const filters = { name: [containerName] }
  let container

  before(async () => {
    container = await getOrCreateContainer(phoneNumber, 'foobar')
  })

  it('spins up a new container', async () => {
    const containers = await dockerClient.listContainers({ filters })
    expect(containers.length).to.eql(1)
  })

  it('retrieves a container by phoneNumber', async () => {
    const fetchedContainer = await getContainer('+15555555555')
    expect(container.Id).to.eql(fetchedContainer.Id)
  })

  it('does not start a second container with same number as running container', async () => {
    await getOrCreateContainer(phoneNumber, 'foobar')
    const containers = await dockerClient.listContainers({ filters })
    expect(containers.length).to.eql(1)
  })

  it('stops a running container', async () => {
    await stopContainer(phoneNumber)
    expect(await getContainer(phoneNumber)).to.eql(null)
  }).timeout(20000)
})
