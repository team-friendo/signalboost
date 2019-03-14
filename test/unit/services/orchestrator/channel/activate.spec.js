import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../../../../app/db/repositories/channel'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import docker from '../../../../../app/services/orchestrator/docker'
import { activate, activateMany } from '../../../../../app/services/orchestrator/channel/activate'
import { genPhoneNumber } from '../../../../support/factories/phoneNumber'
import { statuses } from '../../../../../app/db/models/phoneNumber'

describe('channel activation module', () => {
  const db = {}
  const phoneNumber = '+15555555555'
  const name = '#blackops'
  const containerId = 'acabdeadbeef'
  const admins = ['+12222222222', '+13333333333']
  let createContainerStub, createChannelStub, addAdminsStub, updatePhoneNumberStub

  describe('activating a channel', () => {
    let result
    before(async () => {
      createContainerStub = sinon
        .stub(docker, 'getOrCreateContainer')
        .returns(Promise.resolve({ Id: containerId }))
      createChannelStub = sinon.stub(channelRepository, 'updateOrCreate').returns(
        Promise.resolve({
          phoneNumber,
          name,
          status: 'ACTIVE',
        }),
      )
      addAdminsStub = sinon
        .stub(channelRepository, 'addAdmins')
        .callsFake((db, channelPhoneNumber, admins) =>
          Promise.resolve(
            admins.map(a => ({ channelPhoneNumber: phoneNumber, humanPhoneNumber: a })),
          ),
        )
      updatePhoneNumberStub = sinon
        .stub(phoneNumberRepository, 'update')
        .returns(Promise.resolve({ dataValues: { phoneNumber, status: 'ACTIVE' } }))

      result = await activate({ db, phoneNumber, name, admins })
    })

    after(() => {
      createContainerStub.restore()
      createChannelStub.restore()
      addAdminsStub.restore()
      updatePhoneNumberStub.restore()
    })

    it('starts docker container containing channel for the phone number', () => {
      expect(createContainerStub.getCall(0).args[0]).to.eql(phoneNumber, name)
    })

    it('records channel number and name in db', () => {
      expect(createChannelStub.getCall(0).args).to.eql([db, phoneNumber, name, containerId])
    })

    it('adds admins to channel', () => {
      expect(addAdminsStub.getCall(0).args).to.eql([db, phoneNumber, admins])
    })

    it('it sets phone number status to ACTIVE', () => {
      expect(updatePhoneNumberStub.getCall(0).args).to.eql([db, phoneNumber, { status: 'ACTIVE' }])
    })

    it('returns a channel status with ACTIVE status', () => {
      expect(result).to.eql({
        name,
        status: statuses.ACTIVE,
        phoneNumber,
        admins,
      })
    })
  })

  describe('activating 3 channels', () => {
    let channelAttrs = [
      { phoneNumber: genPhoneNumber(), name: 'foo1' },
      { phoneNumber: genPhoneNumber(), name: 'foo2' },
      { phoneNumber: genPhoneNumber(), name: 'foo3' },
    ]
    let result

    before(async () => {
      createContainerStub = sinon
        .stub(docker, 'getOrCreateContainer')
        .returns(Promise.resolve({ Id: containerId }))
      createChannelStub = sinon.stub(channelRepository, 'updateOrCreate')
      addAdminsStub = sinon.stub(channelRepository, 'addAdmins')
      updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
      result = await activateMany(db, channelAttrs)
    })

    after(() => {
      createContainerStub.restore()
      createChannelStub.restore()
      addAdminsStub.restore()
      updatePhoneNumberStub.restore()
    })

    it('starts 3 docker containers', () => {
      expect(createContainerStub.callCount).to.eql(3)
    })

    it('creates 3 new channel resources in db', () => {
      expect(createChannelStub.callCount).to.eql(3)
    })

    it('sets 3 phone number statuses to active', () => {
      expect(updatePhoneNumberStub.callCount).to.eql(3)
    })

    it('returns 3 channel records', () => {
      expect(result).to.have.length(3)
    })
  })
})
