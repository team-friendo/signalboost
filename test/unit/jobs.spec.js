import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import phoneNumberRegistrar from '../../app/registrar/phoneNumber'
import inviteRepository from '../../app/db/repositories/invite'
import smsSenderRepository from '../../app/db/repositories/smsSender'
import hotlineMessageRepository from '../../app/db/repositories/hotlineMessage'
import jobs from '../../app/jobs'
import diagnostics from '../../app/diagnostics'
import util from '../../app/util'
const {
  job: { testInterval },
} = require('../../app/config')

describe('jobs service', () => {
  let registerAllStub,
    deleteInvitesStub,
    deleteSmsSendersStub,
    deleteHotlineMessagesStub,
    processRecycleRequestsStub,
    sendHealthchecksStub

  /****
   * TODO(aguestuser|2020-09-10):
   *
   *  The fact that this suite kicks of long-running recurring jobs but never
   *  cancels them causes other unit tests to fail non-determinitically, because they
   *  asserting on the same functions that are called repeatedly in this suite.
   *
   *  If this gets annoying enough, we should likely figure out a `jobs.stop()` function
   *  that cancels all the `repeatEvery` calls a
   **/

  describe('running the service', () => {
    let originalReregisterValue = process.env.REREGISTER_ON_STARTUP
    before(async () => {
      // one-off jobs
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
      processRecycleRequestsStub = sinon
        .stub(phoneNumberRegistrar, 'processRecycleRequests')
        .returns(Promise.resolve(['42', '43']))

      process.env.REREGISTER_ON_STARTUP = '1'
      await jobs.run()
    })

    after(() => {
      process.env.REREGISTER_ON_STARTUP = originalReregisterValue
      sinon.restore()
    })

    describe('one-off jobs', () => {
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
      it('lauches a recycle request processing job', () => {
        expect(processRecycleRequestsStub.callCount).at.least(2)
      })
      it('launches a healtcheck job', async () => {
        expect(sendHealthchecksStub.callCount).to.be.at.least(2)
      })
    })
  })
})
