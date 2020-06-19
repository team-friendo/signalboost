import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import {
  twilioClient,
  availableTwilioNumbers,
  purchase,
  purchaseN,
} from '../../../../../app/services/registrar/phoneNumber/purchase'
import { errors, statuses } from '../../../../../app/services/registrar/phoneNumber/common'
import {
  genPhoneNumber,
  genSid,
  twilioNumberCreationResponse,
} from '../../../../support/factories/phoneNumber'

describe('phone number services - purchase module', () => {
  const fakePhoneNumber = genPhoneNumber()
  const twilioSid = genSid()
  let twilioListStub, twilioCreateStub, createPhoneNumberStub

  beforeEach(() => {
    twilioListStub = sinon.stub(availableTwilioNumbers, 'list')
    twilioCreateStub = sinon.stub(twilioClient.incomingPhoneNumbers, 'create')
    createPhoneNumberStub = sinon.stub(phoneNumberRepository, 'create')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('purchasing many phone numbers', () => {
    const fakeNumbers = times(3, genPhoneNumber)
    const sids = times(3, genSid())
    // NOTE(aguestuser): we focus on happy path here, b/c sad paths are exhaustively tested below

    describe('when all searches, payments, and db writes succeed', () => {
      beforeEach(() => {
        fakeNumbers.forEach((number, i) =>
          twilioListStub
            .onCall(i)
            .returns(Promise.resolve([{ phoneNumber: number, twilioSid: sids[i] }])),
        )
        twilioCreateStub.callsFake(x => Promise.resolve(x))
        createPhoneNumberStub.callsFake(x => Promise.resolve(x))
      })

      it('returns an array of success statuses', async () => {
        expect(await purchaseN({ n: 3 })).to.eql([
          {
            status: statuses.PURCHASED,
            phoneNumber: fakeNumbers[0],
            twilioSid: sids[0],
          },
          {
            status: statuses.PURCHASED,
            phoneNumber: fakeNumbers[1],
            twilioSid: sids[1],
          },
          {
            status: statuses.PURCHASED,
            phoneNumber: fakeNumbers[2],
            twilioSid: sids[2],
          },
        ])
      })
    })

    describe('when one payment (twilio number creation) fails', () => {
      beforeEach(() => {
        fakeNumbers.forEach((number, i) =>
          twilioListStub
            .onCall(i)
            .returns(Promise.resolve([{ phoneNumber: number, twilioSid: sids[i] }])),
        )
        twilioCreateStub.onCall(0).callsFake(() => Promise.reject('boom!'))
        twilioCreateStub.onCall(1).callsFake(x => Promise.resolve(x))
        twilioCreateStub.onCall(2).callsFake(x => Promise.resolve(x))
        createPhoneNumberStub.callsFake(x => Promise.resolve(x))
      })

      it('returns an array of success AND error statuses', async () => {
        expect(await purchaseN({  n: 3 })).to.eql([
          {
            status: statuses.ERROR,
            error: errors.purchaseFailed('boom!'),
            phoneNumber: fakeNumbers[0],
          },
          {
            status: statuses.PURCHASED,
            phoneNumber: fakeNumbers[1],
            twilioSid: sids[1],
          },
          {
            status: statuses.PURCHASED,
            phoneNumber: fakeNumbers[2],
            twilioSid: sids[2],
          },
        ])
      })
    })
  })

  describe('purchasing a phone number', () => {
    describe('when twilio number search succeeds', () => {
      beforeEach(() => twilioListStub.returns(Promise.resolve([{ phoneNumber: fakePhoneNumber }])))

      it('attempts to register the number returned by search with twilio', async () => {
        await purchase({})
        expect(twilioCreateStub.getCall(0).args[0].phoneNumber).to.eql(fakePhoneNumber)
      })

      it("includes the current environment in the registered number's friendlyName", async () => {
        await purchase({})
        expect(twilioCreateStub.getCall(0).args[0].friendlyName).to.match(/^test+ .*$/)
      })

      describe('when twilio number registration succeeds', () => {
        beforeEach(() =>
          twilioCreateStub.returns(
            Promise.resolve({
              ...twilioNumberCreationResponse,
              phoneNumber: fakePhoneNumber,
              sid: twilioSid,
            }),
          ),
        )

        describe('when recording phone number state to db succeeds', () => {
          beforeEach(() => createPhoneNumberStub.callsFake(x => Promise.resolve(x)))

          it('returns a success status', async () => {
            expect(await purchase({})).to.eql({
              status: statuses.PURCHASED,
              phoneNumber: fakePhoneNumber,
              twilioSid,
            })
          })
        })

        describe('when recording phone number to db fails', () => {
          beforeEach(() => createPhoneNumberStub.callsFake(() => Promise.reject('oh noes!')))

          it('returns an error tuple', async () => {
            expect(await purchase({})).to.eql({
              status: statuses.ERROR,
              phoneNumber: fakePhoneNumber,
              error: errors.dbWriteFailed('oh noes!'),
            })
          })
        })
      })

      describe('when twilio number registration fails', () => {
        beforeEach(() => twilioCreateStub.callsFake(() => Promise.reject('oh noes!')))

        it('returns an error status', async () => {
          expect(await purchase({})).to.eql({
            status: statuses.ERROR,
            phoneNumber: fakePhoneNumber,
            error: errors.purchaseFailed('oh noes!'),
          })
        })
      })
    })

    describe('when twilio number search fails', () => {
      beforeEach(() => twilioListStub.returns(Promise.reject('oh noes!!')))

      it('returns an error status', async () => {
        expect(await purchase({})).to.eql({
          status: statuses.ERROR,
          phoneNumber: undefined,
          error: errors.searchFailed('oh noes!!'),
        })
      })
    })

    describe('when twilio search returns no results', () => {
      beforeEach(() => twilioListStub.returns(Promise.resolve([])))

      it('returns an error status', async () => {
        expect(await purchase({ areaCode: 111 })).to.eql({
          status: statuses.ERROR,
          phoneNumber: undefined,
          error: errors.searchFailed(errors.searchEmpty),
        })
      })
    })
  })
})
