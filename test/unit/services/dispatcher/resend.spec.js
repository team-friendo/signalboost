import { describe, it } from 'mocha'
import { expect } from 'chai'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { hash } from '../../../../app/services/dispatcher/resend'

describe('resend module', () => {
  const sdMessage = {
    channel: channelFactory(),
    username: genPhoneNumber(),
    recipientNumber: genPhoneNumber(),
    messageBody: 'foo',
    attachments: ['bar', 'baz'],
  }

  describe('#hash', () => {
    it('hashes an sd message into a 20-byte hex string', () => {
      const hashed = hash(sdMessage)
      expect(hashed.length).to.eql(40)
      hashed.split('').forEach(char => expect('0123456789aAbBcCdDeEfF').to.include(char))
    })

    it('produces the same hash for messages with same body, sender, receiver', () => {
      expect(hash(sdMessage)).to.equal(hash(sdMessage))
    })

    it('produces the different hash for different body', () => {
      expect(hash(sdMessage)).not.to.equal(
        hash({
          ...sdMessage,
          messageBody: 'bazinga',
        }),
      )
    })

    it('produces the different hash for different sender (channel number)', () => {
      expect(hash(sdMessage)).not.to.equal(
        hash({
          ...sdMessage,
          username: 'bazinga',
        }),
      )
    })

    it('produces the different hash for different receiver', () => {
      expect(hash(sdMessage)).not.to.equal(
        hash({
          ...sdMessage,
          recipientNumber: 'bazinga',
        }),
      )
    })

    it('produces the different hash for different attachments', () => {
      expect(hash(sdMessage)).not.to.equal(
        hash({
          ...sdMessage,
          attachments: ['baz', 'bar'],
        }),
      )
    })
  })
})
