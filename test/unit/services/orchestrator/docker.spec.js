import { expect } from 'chai'
import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import {
  dockerClient,
  getContainer,
  getOrCreateContainer,
  stopContainer,
  containerNameOf,
} from '../../../../app/services/api/docker'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('docker module', () => {
  const Id = 'acabdeadbeef'
  const phoneNumber = genPhoneNumber()
  const fakeContainer = { Id, id: Id }

  describe('#getContainer', () => {
    let listContainersStub
    beforeEach(() => (listContainersStub = sinon.stub(dockerClient, 'listContainers')))
    afterEach(() => listContainersStub.restore())

    describe('in all cases', () => {
      beforeEach(() => listContainersStub.returns(Promise.resolve([])))
      it('tries to fetch container by its name', async () => {
        await getContainer(phoneNumber)
        expect(listContainersStub.getCall(0).args[0]).to.eql({
          filters: { name: [`signalboost_dispatcher_${phoneNumber.slice(1)}`] },
        })
      })
    })

    describe('when container exists', () => {
      beforeEach(() => listContainersStub.returns(Promise.resolve([fakeContainer])))

      it('returns container', async () => {
        expect(await getContainer(phoneNumber)).to.eql(fakeContainer)
      })
    })
    describe('when container does not exist', () => {
      beforeEach(() => listContainersStub.returns(Promise.resolve([])))

      it('returns null', async () => {
        expect(await getContainer(phoneNumber)).to.eql(null)
      })
    })
  })

  describe('#getOrCreateContainer', () => {
    let container, createContainerStub, listContainersStub

    describe('when container for channel already exists', () => {
      before(async () => {
        listContainersStub = sinon
          .stub(dockerClient, 'listContainers')
          .returns(Promise.resolve([fakeContainer]))
        createContainerStub = sinon
          .stub(dockerClient, 'createContainer')
          .returns(Promise.resolve({ start: () => Promise.resolve({ id: 'someOtherId' }) }))
        container = await getOrCreateContainer('+15555555555', 'foobar')
      })

      after(() => {
        listContainersStub.restore()
        createContainerStub.restore()
      })

      it('does not try to create new container', () => {
        expect(createContainerStub.callCount).to.eql(0)
      })

      it('returns the existing container', () => {
        expect(container).to.eql(fakeContainer)
      })
    })

    describe('when container for channel does not yet exist', () => {
      before(async () => {
        listContainersStub = sinon.stub(dockerClient, 'listContainers').returns(Promise.resolve([]))
        createContainerStub = sinon
          .stub(dockerClient, 'createContainer')
          .returns(Promise.resolve({ start: () => Promise.resolve({ id: Id }) }))
        container = await getOrCreateContainer('+15555555555', 'foobar')
      })
      after(() => {
        listContainersStub.restore()
        createContainerStub.restore()
      })

      it('attempts to create a new container', () => {
        expect(createContainerStub.callCount).to.eql(1)
      })

      it('creates a docker container with the correct configurations', async () => {
        const arg = createContainerStub.getCall(0).args[0]
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

      it('returns the container', () => {
        expect(container).to.eql(fakeContainer)
      })
    })
  })

  describe('#stopContainer', () => {
    let getContainerStub, stopStub, listContainersStub
    beforeEach(async () => {
      stopStub = sinon.stub().returns(Promise.resolve())
      getContainerStub = sinon.stub(dockerClient, 'getContainer').returns({ stop: stopStub })
      listContainersStub = sinon.stub(dockerClient, 'listContainers')
    })
    afterEach(() => {
      getContainerStub.restore()
      listContainersStub.restore()
    })

    describe('when container is not running', () => {
      beforeEach(() => {
        listContainersStub.returns(Promise.resolve([]))
      })

      it('does nothing', async () => {
        await stopContainer(phoneNumber)
        expect(getContainerStub.callCount).to.eql(0)
        expect(stopStub.callCount).to.eql(0)
      })
    })

    describe('when container is running', () => {
      beforeEach(() => {
        listContainersStub.returns(Promise.resolve([fakeContainer]))
      })

      it('retrieves container by its Id  nd stops it', async () => {
        await stopContainer(phoneNumber)
        expect(getContainerStub.getCall(0).args).to.eql([Id])
        expect(stopStub.callCount).to.eql(1)
      })
    })
  })

  describe('#containerNameOf', () => {
    it('constructs a container name from an image name and a phone number', () => {
      expect(containerNameOf('signalboost_dispatcher', '+15555555555')).to.eql(
        'signalboost_dispatcher_15555555555',
      )
    })

    it('constructs a container name when no phone number is provIded', () => {
      expect(containerNameOf('signalboost_dispatcher')).to.eql('signalboost_dispatcher')
    })
  })
})
