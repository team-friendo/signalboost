import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { phoneNumberFactory } from '../../../../support/factories/phoneNumber'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import phoneNumberService from '../../../../../app/services/orchestrator/phoneNumber'
import { times } from 'lodash'

describe('phone number presenters', () => {
  describe('list', () => {
    const phoneNumbers = times(3, phoneNumberFactory)
    let dbListStub

    beforeEach(() => (dbListStub = sinon.stub(phoneNumberRepository, 'list')))
    afterEach(() => dbListStub.restore())

    describe('when db fetch succeeds', () => {
      beforeEach(() => dbListStub.returns(Promise.resolve(phoneNumbers)))

      it('presents a list of phone numbers and a count', async () => {
        expect(await phoneNumberService.list({})).to.eql({
          status: 'SUCCESS',
          count: 3,
          phoneNumbers,
        })
      })
    })

    describe('when db fetch fails', () => {
      beforeEach(() => dbListStub.callsFake(() => Promise.reject('oh noes!')))

      it('presents a list of phone numbers and a count', async () => {
        expect(await phoneNumberService.list({})).to.eql({
          status: 'ERROR',
          error: 'oh noes!',
        })
      })
    })
  })
})
