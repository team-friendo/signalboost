import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import phoneNumberService from '../../../../../app/registrar/phoneNumber/index'

describe('phone number presenters', () => {
  describe('list', () => {
    const phoneNumbers = [
      {
        phoneNumber: '+11111111111',
        status: 'ACTIVE',
        twilioSid: 'f82305bab07b873ca1788ee1fb689b9071',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        phoneNumber: '+12222222222',
        status: 'ACTIVE',
        twilioSid: '48beb86f017ac6a193cb6f8dc9524dbb07',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    let dbListStub

    beforeEach(() => (dbListStub = sinon.stub(phoneNumberRepository, 'list')))
    afterEach(() => sinon.restore())

    describe('in all cases', () => {
      beforeEach(() => dbListStub.returns(Promise.resolve()))

      it('passes filter to repository query', async () => {
        await phoneNumberService.list('ACTIVE')
        expect(dbListStub.getCall(0).args).to.eql(['ACTIVE'])
      })
    })

    describe('when db fetch succeeds', () => {
      beforeEach(() => dbListStub.returns(Promise.resolve(phoneNumbers)))

      it('presents a list of formatted phone numbers and a count', async () => {
        expect(await phoneNumberService.list({})).to.eql({
          status: 'SUCCESS',
          data: {
            count: 2,
            phoneNumbers: [
              {
                phoneNumber: '+11111111111',
                status: 'ACTIVE',
                twilioSid: 'f82305bab07b873ca1788ee1fb689b9071',
              },
              {
                phoneNumber: '+12222222222',
                status: 'ACTIVE',
                twilioSid: '48beb86f017ac6a193cb6f8dc9524dbb07',
              },
            ],
          },
        })
      })
    })

    describe('when db fetch fails', () => {
      beforeEach(() => dbListStub.callsFake(() => Promise.reject('oh noes!')))

      it('presents a list of phone numbers and a count', async () => {
        expect(await phoneNumberService.list({})).to.eql({
          status: 'ERROR',
          data: {
            error: 'oh noes!',
          },
        })
      })
    })
  })
})
