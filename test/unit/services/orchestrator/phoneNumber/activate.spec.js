import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../../../../app/db/repositories/channel'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import docker from '../../../../../app/services/orchestrator/docker'
import { activate } from '../../../../../app/services/orchestrator/phoneNumber/activate'

describe('phoneNumber activation module', () => {
  const db = {}
  const phoneNumber = '+15555555555'
  const channelName = '#blackops'
  const containerId = 'acabdeadbeef'

  describe('activating a phone number', () => {
    let runContainerStub = sinon.stub(docker, 'runContainer')
    let createChannelStub = sinon.stub(channelRepository, 'create')
    let updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')

    before(async () => {
      runContainerStub.returns(Promise.resolve(containerId))
      createChannelStub.returns(
        Promise.resolve({
          phoneNumber,
          name: channelName,
        }),
      )
      updatePhoneNumberStub.returns(Promise.resolve({ phoneNumber, status: 'ACTIVE' }))

      await activate({ db, phoneNumber, channelName })
    })

    after(() => {
      runContainerStub.restore()
      createChannelStub.restore()
      updatePhoneNumberStub.restore()
    })

    it('starts docker container containing channel for the phone number', () => {
      expect(runContainerStub.getCall(0).args[0]).to.eql(phoneNumber, channelName)
    })

    it('records channel number and name in db', () => {
      expect(createChannelStub.getCall(0).args).to.eql([db, phoneNumber, channelName, containerId])
    })

    it('it sets phone number status to ACTIVE', () => {
      expect(updatePhoneNumberStub.getCall(0).args).to.eql([db, phoneNumber, { status: 'ACTIVE' }])
    })
  })
})
