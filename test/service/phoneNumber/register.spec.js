import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import util from '../../../app/service/util'
import { EventEmitter } from 'events'
import {
  register,
  verify,
  parseVerificationCode,
} from '../../../app/service/phoneNumber/register'
import { statuses, errors } from '../../../app/service/phoneNumber/index'
import { genPhoneNumber } from '../../support/factories/phoneNumber'

describe('phone number service -- registration module', () => {
  const phoneNumber = genPhoneNumber()
  const emitter = new EventEmitter()
  const registeredStatus = { status: statuses.REGISTERED, phoneNumber }
  const verifiedStatus = { status: statuses.VERIFIED, phoneNumber }
  const errorStatus = { status: statuses.ERROR, phoneNumber, error: 'oh noes!' }
  const timeoutStatus = { status: statuses.ERROR, phoneNumber, error: errors.verificationTimeout }
  const verificationMessage = 'Your Signal verification code: 809-842 for +14322239406'
  const emitOffset = 10
  const db = { phoneNumber: { update: () => {} } }

  let execStub, updateStub

  beforeEach(() => {
    execStub = sinon.stub(util, 'exec')
    updateStub = sinon.stub(db.phoneNumber, 'update')
  })

  afterEach(() => {
    execStub.restore()
    updateStub.restore()
  })

  describe('registering a number with signal', () => {
    describe('when registration succeeds', () => {
      beforeEach(() => execStub.returns(Promise.resolve()))

      describe('when saving registration status succeeds', () => {
        beforeEach(() => {
          updateStub.returns(Promise.resolve([1, [registeredStatus]]))
        })

        describe('in all cases', () => {
          beforeEach(async () => await register({ db, emitter, phoneNumber }))

          it('listens for successful verification', () => {
            expect(emitter.emit('verified')).to.eql(true)
          })

          it('listens for failed verification', () => {
            expect(emitter.emit('verificationFailed')).to.eql(true)
          })
        })

        describe('when verification success event is fired', () => {
          beforeEach(() => setTimeout(() => emitter.emit('verified', verifiedStatus), emitOffset))

          it('returns a success status', async () => {
            expect(await register({ db, emitter, phoneNumber })).to.eql(verifiedStatus)
          })
        })

        describe('when verification failure event is fired', () => {
          beforeEach(() =>
            setTimeout(() => emitter.emit('verificationFailed', errorStatus), emitOffset),
          )

          it('returns an error status', async () => {
            expect(await register({ db, emitter, phoneNumber })).to.eql(errorStatus)
          })
        })

        describe('when no verification event fires', () => {
          it('returns an error status after a timeout interval', async () => {
            expect(await register({ db, emitter, phoneNumber })).to.eql(timeoutStatus)
          })
        })

        describe('when a verification event for a different phone number is fired', () => {
          const otherNumberSuccessStatus = { ...verifiedStatus, phoneNumber: genPhoneNumber() }
          beforeEach(() =>
            setTimeout(() => emitter.emit('verified', otherNumberSuccessStatus), emitOffset),
          )

          it('returns an error status after a timeout interval', async () => {
            expect(await register({ db, emitter, phoneNumber })).to.eql(timeoutStatus)
          })
        })
      })

      describe('when recording registration fails', () => {
        beforeEach(() => updateStub.callsFake(() => Promise.reject('wild database error!')))

        it('returns an error status', async () => {
          expect(await register({ db, emitter, phoneNumber })).to.eql({
            status: statuses.ERROR,
            phoneNumber,
            error: errors.registrationFailed('wild database error!'),
          })
        })
      })
    })
    describe('when registration fails', () => {
      beforeEach(() => execStub.callsFake(() => Promise.reject('foo')))

      it('returns an error status', async () => {
        expect(await register({ db, emitter, phoneNumber })).to.eql({
          status: statuses.ERROR,
          phoneNumber,
          error: errors.registrationFailed('foo'),
        })
      })
    })
  })

  describe('verifying a number with signal', () => {
    const verifiedEventSpy = sinon.spy()
    const verificationFailedEventSpy = sinon.spy()

    beforeEach(() => {
      emitter.on('verified', verifiedEventSpy)
      emitter.on('verificationFailed', verificationFailedEventSpy)
    })

    afterEach(() => {
      emitter.removeAllListeners()
    })

    describe('when verification succeeds', () => {
      beforeEach(() => execStub.returns(Promise.resolve()))

      // it('attempts to record the success')

      describe('when recording verification succeeds', () => {
        beforeEach(() => updateStub.returns(Promise.resolve([1, [verifiedStatus]])))

        it('emits a success event', async () => {
          await verify({ db, emitter, phoneNumber, verificationMessage })
          expect(verifiedEventSpy.getCall(0).args).to.eql([verifiedStatus])
        })
      })

      describe('when recording verification fails', () => {
        beforeEach(() => updateStub.callsFake(() => Promise.reject('boom!')))

        it('emits an error event', async () => {
          await verify({ db, emitter, phoneNumber, verificationMessage })
          expect(verificationFailedEventSpy.getCall(0).args).to.eql([
            {
              status: statuses.ERROR,
              phoneNumber,
              error: errors.verificationFailed('boom!'),
            },
          ])
        })
      })
    })
    describe('when verification fails', () => {
      beforeEach(() => execStub.callsFake(() => Promise.reject('boom!')))

      it('emits an error event', async () => {
        await verify({ db, emitter, phoneNumber, verificationMessage })
        expect(verificationFailedEventSpy.getCall(0).args).to.eql([
          {
            status: statuses.ERROR,
            phoneNumber,
            error: errors.verificationFailed('boom!'),
          },
        ])
      })
    })
  })

  describe('helpers', () => {
    describe('#parseVerificationCode', () => {
      it('extracts a verification code from a verification message', () => {
        expect(
          parseVerificationCode('Your Signal verification code: 809-842 for +14322239406'),
        ).to.eql('809-842')
      })
    })
  })
})
