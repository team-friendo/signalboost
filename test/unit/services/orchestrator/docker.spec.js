import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import {
  dockerClient,
  runContainer,
  containerNameOf,
  stopContainer,
} from '../../../../app/services/orchestrator/docker'

describe('docker module', () => {
  const id = 'acabdeadbeef'

  describe('#createContainer', () => {
    let containerId, createContainerSpy

    before(async () => {
      createContainerSpy = sinon
        .stub(dockerClient, 'createContainer')
        .returns(Promise.resolve({ start: () => Promise.resolve({ id }) }))
      containerId = await runContainer('+15555555555', 'foobar')
    })
    after(() => {
      createContainerSpy.restore()
    })

    it('creates a docker container with the correct configurations', async () => {
      const arg = createContainerSpy.getCall(0).args[0]
      expect(arg.name).to.eql('signalboost_dispatcher_15555555555')
      expect(arg.Image).to.eql('signalboost')
      expect(arg.Entrypoint).to.eql('/signalboost/bin/entrypoint/dispatcher')
      expect(arg.Env.slice(0, 2)).to.eql([
        'CHANNEL_PHONE_NUMBER=+15555555555',
        'CHANNEL_NAME=foobar',
      ])
      expect(arg.HostConfig).to.eql({
        AutoRemove: true,
        VolumesFrom: ['signalboost_orchestrator'],
        NetworkMode: 'signalboost_default',
      })
    })

    it("returns the container's id", () => {
      expect(id).to.eql(containerId)
    })
  })

  describe('#stopContainer', () => {
    let getContainerStub, stopStub
    before(async () => {
      stopStub = sinon.stub().returns(Promise.resolve())
      getContainerStub = sinon.stub(dockerClient, 'getContainer').returns({ stop: stopStub })
      await stopContainer(id)
    })
    after(() => {
      getContainerStub.restore()
    })

    it('retrieves a container with the given id and stops it', () => {
      expect(getContainerStub.getCall(0).args).to.eql([id])
      expect(stopStub.callCount).to.eql(1)
    })
  })

  describe('#containerNameOf', () => {
    it('parses a container name from a phone number', () => {
      expect(containerNameOf('+15555555555')).to.eql('signalboost_dispatcher_15555555555')
    })
  })
})
