import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import phoneNumberRegistrar from '../../../../app/services/registrar/phoneNumber'
import safetyNumberRegistrar from '../../../../app/services/registrar/safetyNumbers'
import api from '../../../../app/services/registrar/api'
import registrar from '../../../../app/services/registrar/run'
import config from '../../../../app/config'
import { wait } from '../../../../app/services/util'
const {
  signal: { safetyNumberCheckInterval },
} = config

describe('registrar service', () => {
  const db = {}
  const sock = {}
  let registerAllStub, startServerStub, trustAllStub

  describe('running the service', () => {
    before(async () => {
      startServerStub = sinon.stub(api, 'startServer').returns(Promise.resolve())
      registerAllStub = sinon
        .stub(phoneNumberRegistrar, 'registerAllUnregistered')
        .returns(Promise.resolve([]))
      trustAllStub = sinon
        .stub(safetyNumberRegistrar, 'trustAll')
        .returns(Promise.resolve({ successes: 42, errors: 0 }))
      await registrar.run(db, sock)
    })

    after(() => {
      registerAllStub.restore()
      trustAllStub.restore()
    })

    it('registers any unregistered phone numbers with signal', () => {
      expect(registerAllStub.getCall(0).args).to.eql([{ db, sock }])
    })

    it('initializes an api server', () => {
      expect(startServerStub.getCall(0).args).to.eql([3000, db, sock])
    })

    // skip this until we figure out why running this job borks signald
    it.skip('schedules safety number checks', async () => {
      await wait(3 * safetyNumberCheckInterval)
      expect(trustAllStub.callCount).to.be.at.least(3)
    })
  })
})
