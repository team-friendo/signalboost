import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
const sinon = require('sinon')
import {
  twilioClient,
  availableTwilioNumbers,
  statuses,
  errors,
  purchase,
} from '../../app/service/phoneNumber'
import { genPhoneNumber, twilioNumberCreationResponse } from '../support/factories/phoneNumber'

describe('phone number service', () => {
  let db

  describe('purchasing a phone number', () => {
    const fakePhoneNumber = genPhoneNumber()
    let twilioListStub, twilioCreateStub

    beforeEach(() => {
      twilioListStub = sinon.stub(availableTwilioNumbers, 'list')
      twilioCreateStub = sinon.stub(twilioClient.incomingPhoneNumbers, 'create')
    })

    afterEach(() => {
      twilioListStub.restore()
      twilioCreateStub.restore()
    })

    describe('when twilio number search succeeds', () => {
      beforeEach(() => twilioListStub.returns(Promise.resolve([{ phoneNumber: fakePhoneNumber }])))

      it('attempts to register the number returned by search with twilio', async () => {
        await purchase({ db })
        expect(twilioCreateStub.getCall(0).args[0].phoneNumber).to.eql(fakePhoneNumber)
      })

      describe('when twilio number registration succeeds', () => {
        beforeEach(() =>
          twilioCreateStub.returns(
            Promise.resolve({ ...twilioNumberCreationResponse, phoneNumber: fakePhoneNumber }),
          ),
        )

        describe('when recording phone number state to db succeeds', () => {
          beforeEach(() => {
            db = {
              phoneNumber: {
                create: () =>
                  Promise.resolve({
                    phoneNumber: fakePhoneNumber,
                    status: statuses.PURCHASED,
                  }),
              },
            }
          })

          it('returns a status/number tuple', async () => {
            expect(await purchase({ db })).to.eql({
              status: statuses.PURCHASED,
              phoneNumber: fakePhoneNumber,
            })
          })
        })

        describe('when recording phone number to db fails', () => {
          beforeEach(() => {
            db = {
              phoneNumber: { create: () => Promise.reject('oh noes!') },
            }
          })

          it('returns a status/number/error tuple', async () => {
            expect(await purchase({ db })).to.eql({
              status: statuses.ERROR,
              phoneNumber: fakePhoneNumber,
              error: errors.dbWriteFailed('oh noes!'),
            })
          })
        })
      })

      describe('when twilio number registration fails', () => {
        beforeEach(() => twilioCreateStub.callsFake(() => Promise.reject('oh noes!')))

        it('returns a status/number/error tuple', async () => {
          expect(await purchase({})).to.eql({
            status: statuses.ERROR,
            phoneNumber: undefined,
            error: 'oh noes!',
          })
        })
      })
    })

    describe('when twilio number search fails', () => {
      beforeEach(() => twilioListStub.returns(Promise.reject('oh noes!!')))

      it('returns a status/error tuple', async () => {
        expect(await purchase({})).to.eql({
          status: statuses.ERROR,
          phoneNumber: undefined,
          error: 'oh noes!!',
        })
      })
    })

    describe('when twilio search returns no results', () => {
      beforeEach(() => twilioListStub.returns(Promise.resolve([])))

      it('returns a status/error tuple', async () => {
        expect(await purchase({ areaCode: 111 })).to.eql({
          status: statuses.ERROR,
          phoneNumber: undefined,
          error: errors.searchEmpty,
        })
      })
    })
  })
})
