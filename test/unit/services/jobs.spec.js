import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import phoneNumberRegistrar from '../../../app/registrar/phoneNumber'
import inviteRepository from '../../../app/db/repositories/invite'
import smsSenderRepository from '../../../app/db/repositories/smsSender'
import hotlineMessageRepository from '../../../app/db/repositories/hotlineMessage'
import registrar from '../../../app/jobs'

describe('jobs service', () => {
  let registerAllStub, inviteDeletionStub, smsSenderDeletionStub, hotlineMessageDeletionStub

  describe('running the service', () => {
    before(async () => {
      registerAllStub = sinon
        .stub(phoneNumberRegistrar, 'registerAllUnregistered')
        .returns(Promise.resolve([]))
      inviteDeletionStub = sinon.stub(inviteRepository, 'launchInviteDeletionJob')
      smsSenderDeletionStub = sinon.stub(smsSenderRepository, 'deleteExpired')
      hotlineMessageDeletionStub = sinon.stub(hotlineMessageRepository, 'deleteExpired')
      await registrar.run()
    })

    after(() => {
      sinon.restore()
    })

    it('registers any unregistered phone numbers with signal', () => {
      expect(registerAllStub.callCount).to.be.above(0)
    })

    it('launches an invite deletion job', () => {
      expect(inviteDeletionStub.callCount).to.be.above(0)
    })

    it('deletes all expired sms sender records', () => {
      expect(smsSenderDeletionStub.callCount).to.be.above(0)
    })

    it('deletes all expired hotline message records', () => {
      expect(hotlineMessageDeletionStub.callCount).to.be.above(0)
    })
  })
})
