import { expect } from 'chai'
import { describe, it, before } from 'mocha'
import { dockerClient, runContainer, stopContainer } from '../../app/services/orchestrator/docker'

describe('using the docker client api', () => {
  // NOTE: orchestrator container must be running for these tests to pass!
  let containerId
  before(async () => {
    containerId = await runContainer('+15555555555', 'foobar')
  })

  const findContainerWithName = name =>
    dockerClient.listContainers().then(cs => cs.find(c => c.Names[0] === name))

  it('spins up a new container', async () => {
    const container = await findContainerWithName('/signalboost_dispatcher_15555555555')
    expect(container.Id).to.eql(containerId)
  })

  it('stops a running container', async () => {
    await stopContainer(containerId)
    expect(await findContainerWithName('/signalboost_dispatcher_15555555555')).to.eql(undefined)
  }).timeout(20000)
})
