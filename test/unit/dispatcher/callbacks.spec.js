import { expect } from 'chai'
import { describe, it } from 'mocha'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { messageTypes } from '../../../app/signal'
import { genFingerprint } from '../../support/factories/deauthorization'
import callbacks from '../../../app/dispatcher/callbacks'

describe('callback registry', () => {
  const channelPhoneNumber = genPhoneNumber()
  const subscriberNumber = genPhoneNumber()
  const fingerprint = genFingerprint()
  const trustRequest = {
    type: messageTypes.TRUST,
    username: channelPhoneNumber,
    recipientNumber: subscriberNumber,
    fingerprint,
  }
  const trustResponse = {
    type: messageTypes.TRUSTED_FINGERPRINT,
    data: {
      msg_number: 0,
      message: 'Successfully trusted fingerprint',
      error: true,
      request: trustRequest,
    },
  }
  const trustSocket = {}

  describe('registering callbacks', () => {
    describe('for a trust request', () => {
      it('registers a trust response handler', () => {
        callbacks.register(trustSocket, trustRequest)
        expect(callbacks.registry[`${messageTypes.TRUST}-${fingerprint}`]).to.eql({
          socket: trustSocket,
          callback: callbacks.handleTrustResponse,
        })
      })
    })
  })

  describe('retrieving callbacks', () => {
    describe('for a trust reponse', () => {
      it('retrieves the trust resposnse handler', () => {
        callbacks.register(trustSocket, trustRequest)
        const { socket, callback } = callbacks.route(trustResponse)
        expect(socket).to.eql(trustSocket)
        expect(callback).to.eql(callbacks.handleTrustResponse)
      })
      describe('for an unregistered callback', () => {
        it('returns undefined', () => {
          expect(callbacks.route(trustResponse)).to.equal(undefined)
          expect(callbacks.route({ type: 'foobar' })).to.eql(undefined)
        })
      })
    })
  })
})
