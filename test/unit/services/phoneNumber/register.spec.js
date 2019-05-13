import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import fs from 'fs-extra'
import { times } from 'lodash'
import {
  register,
  registerAllPurchased,
  registerAllUnregistered,
  verify,
} from '../../../../app/services/phoneNumber/register'
import signal from '../../../../app/services/signal'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import { statuses, errors } from '../../../../app/services/phoneNumber/index'
import { genPhoneNumber, phoneNumberFactory } from '../../../support/factories/phoneNumber'
import { wait } from '../../../../app/services/util'
const {
  signal: {
    registrationBatchSize,
    intervalBetweenRegistrationBatches,
    intervalBetweenRegistrations,
  },
} = require('../../../../app/config/index')

describe('phone number services -- registration module', () => {
  const phoneNumber = genPhoneNumber()
  const phoneNumbers = times(3, () => ({
    phoneNumber: genPhoneNumber(),
    status: statuses.PURCHASED,
  }))
  const verifiedStatus = { status: statuses.VERIFIED, phoneNumber }
  const sock = {}
  const db = {}

  let registerStub,
    awaitVerificationStub,
    verifyStub,
    updateStub,
    findAllStub,
    findAllPurchasedStub,
    pathExistsStub

  const updateSucceeds = () =>
    updateStub.callsFake((_, phoneNumber, { status }) => Promise.resolve({ phoneNumber, status }))

  const updateSucceedsOnCall = n =>
    updateStub
      .onCall(n)
      .callsFake((_, phoneNumber, { status }) => Promise.resolve({ phoneNumber, status }))

  const registrationSucceeds = () =>
    registerStub.returns(
      Promise.resolve({
        type: signal.messageTypes.VERIFICATION_REQUIRED,
        data: {
          username: phoneNumber,
        },
      }),
    )

  const verificationSucceeds = () =>
    awaitVerificationStub.returns(
      Promise.resolve({
        type: signal.messageTypes.VERIFICATION_SUCCESS,
        data: {
          username: phoneNumber,
        },
      }),
    )

  const verificationSucceedsOnCall = n =>
    awaitVerificationStub.onCall(n).returns(
      Promise.resolve({
        type: signal.messageTypes.VERIFICATION_SUCCESS,
        data: {
          username: phoneNumber,
        },
      }),
    )

  beforeEach(() => {
    registerStub = sinon.stub(signal, 'register')
    awaitVerificationStub = sinon.stub(signal, 'awaitVerificationResult')
    verifyStub = sinon.stub(signal, 'verify')
    findAllStub = sinon.stub(phoneNumberRepository, 'findAll')
    findAllPurchasedStub = sinon.stub(phoneNumberRepository, 'findAllPurchased')
    updateStub = sinon.stub(phoneNumberRepository, 'update')
    pathExistsStub = sinon.stub(fs, 'pathExists')
  })

  afterEach(() => {
    registerStub.restore()
    awaitVerificationStub.restore()
    verifyStub.restore()
    updateStub.restore()
    findAllStub.restore()
    findAllPurchasedStub.restore()
    pathExistsStub.restore()
  })

  describe('registering a number with signal', () => {
    describe('in all cases', () => {
      beforeEach(async () => {
        registerStub.returns(Promise.resolve())
        awaitVerificationStub.returns(Promise.resolve())
        updateStub.returns(Promise.resolve())
      })

      it('attempts to register a phone number', async () => {
        await register({ db, sock, phoneNumber })
        expect(registerStub.callCount).to.eql(1)
      })
    })

    describe('when registration succeeds', () => {
      beforeEach(() => registrationSucceeds())

      it('attempts to record registered status', async () => {
        await register({ db, sock, phoneNumber })
        expect(updateStub.getCall(0).args).to.eql([
          db,
          phoneNumber,
          { status: statuses.REGISTERED },
        ])
      })

      describe('when saving registration status succeeds', () => {
        beforeEach(async () => {
          updateSucceedsOnCall(0)
          awaitVerificationStub.returns(Promise.resolve())
        })

        it('listens for verification result', async () => {
          await register({ db, sock, phoneNumber })
          expect(awaitVerificationStub.callCount).to.eql(1)
        })

        describe('when verification succeeds', () => {
          beforeEach(() => verificationSucceeds())

          it('attempts to save verification status', async () => {
            await register({ db, sock, phoneNumber })
            expect(updateStub.getCall(1).args).to.eql([
              db,
              phoneNumber,
              { status: statuses.VERIFIED },
            ])
          })

          describe('when saving verification status succeeds', () => {
            beforeEach(() => updateSucceedsOnCall(1))

            it('returns a success status', async () => {
              expect(await register({ db, sock, phoneNumber })).to.eql(verifiedStatus)
            })
          })

          describe('when saving verification status fails', () => {
            beforeEach(() =>
              updateStub
                .onCall(1)
                .callsFake(() => Promise.reject(new Error('wild database error!'))),
            )

            it('returns an error status', async () => {
              expect(await register({ db, sock, phoneNumber })).to.eql({
                status: statuses.ERROR,
                phoneNumber,
                error: errors.registrationFailed('Error: wild database error!', phoneNumber),
              })
            })
          })
        })

        describe('when verification fails', () => {
          beforeEach(() => {
            awaitVerificationStub.callsFake(() => Promise.reject(new Error('oh noes!')))
            updateStub.returns(Promise.resolve())
          })

          it('returns an error status', async () => {
            expect(await register({ db, sock, phoneNumber })).to.eql({
              status: statuses.ERROR,
              phoneNumber,
              error: errors.registrationFailed('Error: oh noes!', phoneNumber),
            })
          })
        })
      })

      describe('when recording registration fails', () => {
        beforeEach(() =>
          updateStub.onCall(0).callsFake(() => Promise.reject('wild database error!')),
        )

        it('returns an error status', async () => {
          expect(await register({ db, sock, phoneNumber })).to.eql({
            status: statuses.ERROR,
            phoneNumber,
            error: errors.registrationFailed('wild database error!'),
          })
        })
      })
    })

    describe('when registration fails', () => {
      beforeEach(() => registerStub.callsFake(() => Promise.reject(new Error('foo'))))

      it('returns an error status', async () => {
        expect(await register({ db, sock, phoneNumber })).to.eql({
          status: statuses.ERROR,
          phoneNumber,
          error: errors.registrationFailed('Error: foo'),
        })
      })
    })
  })

  describe('registering all purchased numbers with signal', () => {
    describe('in all cases', () => {
      const twoBatchesOfPhoneNumbers = times(registrationBatchSize + 1, phoneNumberFactory)
      beforeEach(() => {
        findAllPurchasedStub.returns(Promise.resolve(twoBatchesOfPhoneNumbers))
        registrationSucceeds()
        verificationSucceeds()
        updateSucceeds()
      })

      it('attempts to register phone numbers in batches', async () => {
        registerAllPurchased({ db, sock })
        await wait((registrationBatchSize + 1) * intervalBetweenRegistrations)
        expect(registerStub.callCount).to.eql(registrationBatchSize)
        await wait(intervalBetweenRegistrations) // to avoid side effects on other tests
      })

      it('waits a set interval between batches and between registrations', async () => {
        const start = new Date().getTime()
        await registerAllPurchased({ db, sock }).catch(a => a)
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
        findAllPurchasedStub.returns(Promise.resolve(phoneNumbers))
        registrationSucceeds()
        verificationSucceeds()
        updateSucceeds()
      })

      it('returns an array of success statuses', async () => {
        expect(await registerAllPurchased({ db, sock })).to.eql([
          {
            status: statuses.VERIFIED,
            phoneNumber: phoneNumbers[0].phoneNumber,
          },
          {
            status: statuses.VERIFIED,
            phoneNumber: phoneNumbers[1].phoneNumber,
          },
          {
            status: statuses.VERIFIED,
            phoneNumber: phoneNumbers[2].phoneNumber,
          },
        ])
      })
    })

    describe('when one registration fails', () => {
      beforeEach(() => {
        findAllPurchasedStub.returns(Promise.resolve(phoneNumbers))
        registrationSucceeds()
        updateSucceeds()
        verificationSucceedsOnCall(0)
        verificationSucceedsOnCall(1)
        awaitVerificationStub
          .onCall(2)
          .callsFake(() => Promise.reject(new Error('verification timed out')))
      })

      it('returns an array of success AND error statuses', async () => {
        expect(await registerAllPurchased({ db, sock })).to.eql([
          {
            status: statuses.VERIFIED,
            phoneNumber: phoneNumbers[0].phoneNumber,
          },
          {
            status: statuses.VERIFIED,
            phoneNumber: phoneNumbers[1].phoneNumber,
          },
          {
            status: statuses.ERROR,
            phoneNumber: phoneNumbers[2].phoneNumber,
            error: errors.registrationFailed('Error: verification timed out'),
          },
        ])
      })
    })
  })

  describe('registering all unregistered numbers with signal', () => {
    beforeEach(() => {
      findAllStub.returns(Promise.resolve(phoneNumbers))
      registrationSucceeds()
      verificationSucceeds()
      updateSucceeds()
    })

    describe('in all cases', () => {
      const twoBatchesOfPhoneNumbers = times(registrationBatchSize + 1, phoneNumberFactory)
      beforeEach(() => {
        findAllStub.returns(Promise.resolve(twoBatchesOfPhoneNumbers))
      })

      it('attempts to register phone numbers in batches', async () => {
        registerAllUnregistered({ db, sock })
        await wait((registrationBatchSize + 1) * intervalBetweenRegistrations)
        expect(registerStub.callCount).to.eql(registrationBatchSize)
        await wait(intervalBetweenRegistrations) // to avoid side effects on other tests
      })

      it('waits a set interval between batches and between registrations', async () => {
        const start = new Date().getTime()
        await registerAllUnregistered({ db, sock }).catch(a => a)
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
        // NOTE: we omit sad path tests b/c those are covered exhaustively above and below
        it('returns an array of success statuses', async () => {
          expect(await registerAllUnregistered({ db, sock })).to.eql([
            {
              status: statuses.VERIFIED,
              phoneNumber: phoneNumbers[0].phoneNumber,
            },
            {
              status: statuses.VERIFIED,
              phoneNumber: phoneNumbers[1].phoneNumber,
            },
            {
              status: statuses.VERIFIED,
              phoneNumber: phoneNumbers[2].phoneNumber,
            },
          ])
        })
      })
    })

    describe('when a phone number is already in the keystore and marked as verified in the db', () => {
      beforeEach(() => {
        registrationSucceeds()
        verificationSucceeds()
        updateSucceeds()
        pathExistsStub.onCall(0).returns(Promise.resolve(false))
        pathExistsStub.onCall(1).returns(Promise.resolve(false))
        pathExistsStub.onCall(2).returns(Promise.resolve(true))
        findAllStub.returns(
          Promise.resolve([
            ...phoneNumbers.slice(0, 2),
            { ...phoneNumbers[2], status: statuses.VERIFIED },
          ]),
        )
      })

      it('does not attempt to register that phone number', async () => {
        await registerAllUnregistered({ db, sock })
        expect(registerStub.callCount).to.eql(2)
      })
    })
  })

  describe('verifying a number with signal', () => {
    const verificationMessage = 'Your Signal verification code: 809-842 for +14322239406'

    describe('in all cases', () => {
      beforeEach(async () => {
        verifyStub.returns(Promise.resolve())
        await verify({ sock, phoneNumber, verificationMessage })
      })

      it('parses a verification code and attempts to verify it', () => {
        expect(verifyStub.getCall(0).args).to.eql([sock, phoneNumber, '809-842'])
      })
    })

    describe('when sending the verification code succeeds', () => {
      beforeEach(() => verifyStub.returns(Promise.resolve()))

      it('waits for a verification result from signald', async () => {
        await verify({ db, sock, phoneNumber, verificationMessage })
        expect(awaitVerificationStub.callCount).to.eql(1)
      })

      describe('when verification succeeds', () => {
        beforeEach(() => verificationSucceeds())

        it('returns the success message from signald', async () => {
          expect(await verify({ db, sock, phoneNumber, verificationMessage })).to.eql({
            type: signal.messageTypes.VERIFICATION_SUCCESS,
            data: {
              username: phoneNumber,
            },
          })
        })
      })

      describe('when verification fails', () => {
        beforeEach(() =>
          awaitVerificationStub.callsFake(() => Promise.reject(new Error('rate limited'))),
        )

        it('rejects with an error', async () => {
          const result = await verify({ db, sock, phoneNumber, verificationMessage }).catch(a => a)
          expect(result).to.be.a('Error')
          expect(result.message).to.eql('rate limited')
        })
      })
    })

    describe('when sending the verification code fails', () => {
      beforeEach(() => verifyStub.callsFake(() => Promise.reject(new Error('weird network error'))))

      it('rejects with an error', async () => {
        const result = await verify({ db, sock, phoneNumber, verificationMessage }).catch(a => a)
        expect(result).to.be.a('Error')
        expect(result.message).to.eql('weird network error')
      })
    })
  })
})
