import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import phoneNumberRegistrar from '../../../../app/services/registrar/phoneNumber'
import inviteRepository from '../../../../app/db/repositories/invite'
import smsSenderRepository from '../../../../app/db/repositories/smsSender'
import hotlineMessageRepository from '../../../../app/db/repositories/hotlineMessage'
import api from '../../../../app/services/registrar/api'
import registrar from '../../../../app/services/registrar/run'

describe('registrar service', () => {
  const db = {}
  const sock = {}
  let registerAllStub,
    startServerStub,
    inviteDeletionStub,
    smsSenderDeletionStub,
    hotlineMessageDeletionStub

  describe('running the service', () => {
    before(async () => {
      startServerStub = sinon.stub(api, 'startServer').returns(Promise.resolve())
      registerAllStub = sinon
        .stub(phoneNumberRegistrar, 'registerAllUnregistered')
        .returns(Promise.resolve([]))
      inviteDeletionStub = sinon.stub(inviteRepository, 'launchInviteDeletionJob')
      smsSenderDeletionStub = sinon.stub(smsSenderRepository, 'deleteExpired')
      hotlineMessageDeletionStub = sinon.stub(hotlineMessageRepository, 'deleteExpired')
      await registrar.run(db, sock)
    })

    after(() => {
      startServerStub.restore()
      registerAllStub.restore()
      inviteDeletionStub.restore()
      smsSenderDeletionStub.restore()
      hotlineMessageDeletionStub.restore()
    })

    it('registers any unregistered phone numbers with signal', () => {
      expect(registerAllStub.getCall(0).args).to.eql([{ db, sock }])
    })

    it('initializes an api server', () => {
      expect(startServerStub.getCall(0).args).to.eql([3000, db, sock])
    })

    it('launches an invite deletion job', () => {
      expect(inviteDeletionStub.getCall(0).args).to.eql([db])
    })

    it('deletes all expired sms sender records', () => {
      expect(smsSenderDeletionStub.callCount).to.be.above(0)
    })

    it('deletes all expired hotline message records', () => {
      expect(hotlineMessageDeletionStub.callCount).to.be.above(0)
    })
  })
})
