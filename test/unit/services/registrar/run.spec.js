import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import phoneNumberRegistrar from '../../../../app/services/registrar/phoneNumber'
import inviteRepository from '../../../../app/db/repositories/invite'
import api from '../../../../app/services/registrar/api'
import registrar from '../../../../app/services/registrar/run'

describe('registrar service', () => {
  const db = {}
  const sock = {}
  let registerAllStub, startServerStub, inviteDeletionStub

  describe('running the service', () => {
    before(async () => {
      startServerStub = sinon.stub(api, 'startServer').returns(Promise.resolve())
      registerAllStub = sinon
        .stub(phoneNumberRegistrar, 'registerAllUnregistered')
        .returns(Promise.resolve([]))
      inviteDeletionStub = sinon.stub(inviteRepository, 'launchInviteDeletionJob')
      await registrar.run(db, sock)
    })

    after(() => {
      registerAllStub.restore()
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
  })
})
