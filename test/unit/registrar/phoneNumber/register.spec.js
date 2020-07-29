import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import fs from 'fs-extra'
import { times } from 'lodash'
import signal from '../../../../app/signal'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import { errors, statuses as pnStatuses } from '../../../../app/registrar/phoneNumber'
import { statuses } from '../../../../app/util'
import { genPhoneNumber, phoneNumberFactory } from '../../../support/factories/phoneNumber'
import { wait } from '../../../../app/util'
import logger from '../../../../app/registrar/logger'
import {
  register,
  registerAllUnregistered,
  registerMany,
} from '../../../../app/registrar/phoneNumber/register'

const {
  signal: {
    registrationBatchSize,
    intervalBetweenRegistrationBatches,
    intervalBetweenRegistrations,
  },
} = require('../../../../app/config')

describe('phone number services -- registration module', () => {
  const sock = {}
  const phoneNumber = genPhoneNumber()
  const phoneNumbers = times(3, phoneNumberFactory)
  const purchasedPhoneNumberStatuses = phoneNumbers.map(phoneNumber => ({
    status: 'PURCHASED',
    phoneNumber,
  }))
  const twoBatchesOfPhoneNumbers = times(registrationBatchSize + 1, phoneNumberFactory)
  const verifiedStatus = { status: pnStatuses.VERIFIED, phoneNumber }

  let registerStub, updateStub, findAllStub, pathExistsStub

  const updateSucceeds = () =>
    updateStub.callsFake((phoneNumber, { status }) => Promise.resolve({ phoneNumber, status }))

  const registrationSucceeds = () =>
    registerStub.returns(
      Promise.resolve({
        type: statuses.SUCCESS,
        message: phoneNumber,
      }),
    )

  const registrationSucceedsOnCall = n =>
    registerStub.onCall(n).returns(
      Promise.resolve({
        type: statuses.SUCCESS,
        message: phoneNumber,
      }),
    )

  beforeEach(() => {
    registerStub = sinon.stub(signal, 'register')
    findAllStub = sinon.stub(phoneNumberRepository, 'findAll')
    sinon.stub(phoneNumberRepository, 'findAllPurchased')
    updateStub = sinon.stub(phoneNumberRepository, 'update')
    pathExistsStub = sinon.stub(fs, 'pathExists')
    sinon.stub(logger, 'log')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('registering a number with signal', () => {
    describe('in all cases', () => {
      beforeEach(async () => {
        registerStub.returns(Promise.resolve())
        updateStub.returns(Promise.resolve())
      })

      it('attempts to register a phone number', async () => {
        await register(phoneNumber)
        expect(registerStub.callCount).to.eql(1)
      })
    })

    describe('when registration succeeds', () => {
      beforeEach(() => registrationSucceeds())

      describe('when saving verification status succeeds', () => {
        beforeEach(() => updateSucceeds())

        it('returns a success status', async () => {
          expect(await register(phoneNumber)).to.eql(verifiedStatus)
        })
      })

      describe('when saving verification status fails', () => {
        beforeEach(() =>
          updateStub.callsFake(() => Promise.reject(new Error('wild database error!'))),
        )

        it('returns an error status', async () => {
          expect(await register(phoneNumber)).to.eql({
            status: pnStatuses.ERROR,
            phoneNumber,
            error: errors.registrationFailed('wild database error!', phoneNumber),
          })
        })
      })

      describe('when registration fails', () => {
        beforeEach(() => {
          registerStub.callsFake(() => Promise.reject(new Error('oh noes!')))
          updateStub.returns(Promise.resolve())
        })

        it('returns an error status', async () => {
          expect(await register(phoneNumber)).to.eql({
            status: pnStatuses.ERROR,
            phoneNumber,
            error: errors.registrationFailed('oh noes!', phoneNumber),
          })
        })
      })
    })
  })

  describe('registering many numbers with signal', () => {
    describe('in all cases', () => {
      beforeEach(() => {
        registrationSucceeds()
        updateSucceeds()
      })

      it('attempts to register phone numbers in batches', async () => {
        registerMany(twoBatchesOfPhoneNumbers)
        await wait(twoBatchesOfPhoneNumbers.length * intervalBetweenRegistrations)
        expect(registerStub.callCount).to.be.at.most(registrationBatchSize)
        await wait(intervalBetweenRegistrations * 2) // to avoid side effects on other tests
      })

      it('waits a set interval between batches and between registrations', async () => {
        const start = new Date().getTime()
        await registerMany(twoBatchesOfPhoneNumbers).catch(a => a)
        const elapsed = new Date().getTime() - start
        expect(elapsed).to.be.above(
          (twoBatchesOfPhoneNumbers.length - 2) * intervalBetweenRegistrations +
            intervalBetweenRegistrationBatches,
        )
      })
    })

    describe('when all registrations succeed', () => {
      // NOTE: we focus on happy path b/c sad path is covered exhaustively above
      beforeEach(() => {
        registrationSucceeds()
        updateSucceeds()
      })

      it('returns an array of success pnStatuses', async () => {
        expect(await registerMany(phoneNumbers)).to.eql([
          {
            status: pnStatuses.VERIFIED,
            phoneNumber: phoneNumbers[0],
          },
          {
            status: pnStatuses.VERIFIED,
            phoneNumber: phoneNumbers[1],
          },
          {
            status: pnStatuses.VERIFIED,
            phoneNumber: phoneNumbers[2],
          },
        ])
      })
    })

    describe('when one registration fails', () => {
      beforeEach(() => {
        updateSucceeds()
        registrationSucceedsOnCall(0)
        registrationSucceedsOnCall(1)
        registerStub.onCall(2).callsFake(() => Promise.reject(new Error('verification timed out')))
      })

      it('returns an array of success AND error pnStatuses', async () => {
        expect(await registerMany(phoneNumbers)).to.eql([
          {
            status: pnStatuses.VERIFIED,
            phoneNumber: phoneNumbers[0],
          },
          {
            status: pnStatuses.VERIFIED,
            phoneNumber: phoneNumbers[1],
          },
          {
            status: pnStatuses.ERROR,
            phoneNumber: phoneNumbers[2],
            error: errors.registrationFailed('verification timed out'),
          },
        ])
      })
    })
  })

  describe('registering all unregistered numbers with signal', () => {
    beforeEach(() => {
      findAllStub.returns(Promise.resolve(purchasedPhoneNumberStatuses))
      registrationSucceeds()
      updateSucceeds()
    })

    describe('in all cases', () => {
      const twoBatchesOfPhoneNumbers = times(registrationBatchSize + 1, phoneNumberFactory)
      beforeEach(() => {
        findAllStub.returns(Promise.resolve(twoBatchesOfPhoneNumbers))
      })

      it('attempts to register phone numbers in batches', async () => {
        registerAllUnregistered({ sock })
        await wait(twoBatchesOfPhoneNumbers.length * intervalBetweenRegistrations)
        expect(registerStub.callCount).to.be.at.most(registrationBatchSize)
        await wait(intervalBetweenRegistrations * 2) // to avoid side effects on other tests
      })

      it('waits a set interval between batches and between registrations', async () => {
        const start = new Date().getTime()
        await registerAllUnregistered({ sock }).catch(a => a)
        const elapsed = new Date().getTime() - start
        expect(elapsed).to.be.above(
          (twoBatchesOfPhoneNumbers.length - 2) * intervalBetweenRegistrations +
            intervalBetweenRegistrationBatches,
        )
      })
    })

    describe('when all phone numbers are not registered', () => {
      beforeEach(() => pathExistsStub.returns(Promise.resolve(true)))

      describe('when all registrations succeed', () => {
        // NOTE: we omit sad path tests b/c those are covered exhaustively above
        it('returns an array of success pnStatuses', async () => {
          expect(await registerAllUnregistered({ sock })).to.eql([
            {
              status: pnStatuses.VERIFIED,
              phoneNumber: phoneNumbers[0],
            },
            {
              status: pnStatuses.VERIFIED,
              phoneNumber: phoneNumbers[1],
            },
            {
              status: pnStatuses.VERIFIED,
              phoneNumber: phoneNumbers[2],
            },
          ])
        })
      })
    })

    describe('when a phone number is already in the keystore and marked as verified in the db', () => {
      beforeEach(() => {
        registrationSucceeds()
        updateSucceeds()
        pathExistsStub.onCall(0).returns(Promise.resolve(false))
        pathExistsStub.onCall(1).returns(Promise.resolve(false))
        pathExistsStub.onCall(2).returns(Promise.resolve(true))
        findAllStub.returns(
          Promise.resolve([
            ...phoneNumbers.slice(0, 2),
            { ...phoneNumbers[2], status: pnStatuses.VERIFIED },
          ]),
        )
      })

      it('does not attempt to register that phone number', async () => {
        await registerAllUnregistered({ sock })
        expect(registerStub.callCount).to.eql(2)
      })
    })
  })
})
