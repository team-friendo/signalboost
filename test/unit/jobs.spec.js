import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import phoneNumberRegistrar from '../../app/registrar/phoneNumber'
import inviteRepository from '../../app/db/repositories/invite'
import smsSenderRepository from '../../app/db/repositories/smsSender'
import hotlineMessageRepository from '../../app/db/repositories/hotlineMessage'
import jobs from '../../app/jobs'
import diagnostics from '../../app/diagnostics'
import sharding from '../../app/sharding'
import util from '../../app/util'
const {
  jobs: { testInterval },
} = require('../../app/config')

describe('jobs service', () => {
  let assignChannelsToSocketsStub,
    registerAllStub,
    deleteInvitesStub,
    deleteSmsSendersStub,
    deleteHotlineMessagesStub,
    deleteVestigalKeystoreEntriesStub,
    requestDestructionStub,
    processDestructionRequestsStub,
    sendHealthchecksStub

  describe('running the service', () => {
    let originalReregisterValue = process.env.REREGISTER_ON_STARTUP
    before(async () => {
      // one-off jobs
      assignChannelsToSocketsStub = sinon
        .stub(sharding, 'assignChannelsToSockets')
        .returns(Promise.resolve([1, 2, 3]))
      deleteVestigalKeystoreEntriesStub = sinon
        .stub(phoneNumberRegistrar, 'deleteVestigalKeystoreEntries')
        .returns(Promise.resolve(42))
      registerAllStub = sinon
        .stub(phoneNumberRegistrar, 'registerAllUnregistered')
        .returns(Promise.resolve([]))
      deleteSmsSendersStub = sinon
        .stub(smsSenderRepository, 'deleteExpired')
        .returns(Promise.resolve(1))
      deleteHotlineMessagesStub = sinon
        .stub(hotlineMessageRepository, 'deleteExpired')
        .returns(Promise.resolve(1))

      // repeating jobs
      deleteInvitesStub = sinon.stub(inviteRepository, 'deleteExpired').returns(Promise.resolve(1))
      sendHealthchecksStub = sinon.stub(diagnostics, 'sendHealthchecks').returns(Promise.resolve())
      requestDestructionStub = sinon
        .stub(phoneNumberRegistrar, 'requestToDestroyStaleChannels')
        .returns(
          Promise.resolve([
            { status: 'SUCCESS', message: 'yay!' },
            { status: 'SUCCESS', message: 'yay!' },
          ]),
        )
      processDestructionRequestsStub = sinon
        .stub(phoneNumberRegistrar, 'processDestructionRequests')
        .returns(Promise.resolve(['42', '43']))

      process.env.REREGISTER_ON_STARTUP = '1'
      await jobs.run()
    })

    after(() => {
      process.env.REREGISTER_ON_STARTUP = originalReregisterValue
      sinon.restore()
      jobs.stop()
    })

    describe('one-off jobs', () => {
      it('assigns channels to socket pools', () => {
        expect(assignChannelsToSocketsStub.callCount).to.be.above(0)
      })

      it('deletes any vestigal signald keystore entries', () => {
        expect(deleteVestigalKeystoreEntriesStub.callCount).to.be.above(0)
      })

      it('registers any unregistered phone numbers with signal', () => {
        expect(registerAllStub.callCount).to.be.above(0)
      })

      it('deletes all expired sms sender records', () => {
        expect(deleteSmsSendersStub.callCount).to.be.above(0)
      })

      it('deletes all expired hotline message records', () => {
        expect(deleteHotlineMessagesStub.callCount).to.be.above(0)
      })
    })

    describe('recurring jobs', () => {
      before(async () => await util.wait(testInterval))
      it('launches an invite deletion job', () => {
        expect(deleteInvitesStub.callCount).to.be.at.least(2)
      })
      it('launches a destruction request issuing job', () => {
        // TODO: Restore after spam outage resolved!
        // expect(requestDestructionStub.callCount).to.be.at.least(2)
        expect(requestDestructionStub.callCount).to.eql(0)
      })
      it('launches a destruction request processing job', () => {
        // TODO: restore after spam outage resolved!
        // expect(processDestructionRequestsStub.callCount).to.be.at.least(2)
        expect(processDestructionRequestsStub.callCount).to.eql(0)
      })
      it('launches a healtcheck job', async () => {
        expect(sendHealthchecksStub.callCount).to.be.at.least(2)
      })
    })
  })
})
