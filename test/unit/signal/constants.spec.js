import { expect } from 'chai'
import { describe, it } from 'mocha'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { sdMessageOf } from '../../../app/signal/constants'

describe('signal constants', () => {
  describe('sdMessageOf', () => {
    const sender = genPhoneNumber()
    const recipient = genPhoneNumber()
    const message = 'foo'
    const attachments = [{ filename: 'some/path', width: 42, height: 42, voiceNote: false }]
    const expiresInSeconds = 60 * 60 // 1 hour in secs

    it('constructs a signald message from a channel number, recipient, message, attachments, and expiry time', () => {
      expect(sdMessageOf({ sender, recipient, message, attachments, expiresInSeconds })).to.eql({
        type: 'send',
        username: sender,
        recipientAddress: { number: recipient },
        messageBody: message,
        attachments,
        expiresInSeconds,
      })
    })

    it('provides an empty attachments array and expiry time if none are provided', () => {
      expect(sdMessageOf({ sender, recipient, message })).to.eql({
        type: 'send',
        username: sender,
        recipientAddress: { number: recipient },
        messageBody: message,
        attachments: [],
        expiresInSeconds: 60 * 60 * 24 * 7, // 1 week in sec
      })
    })
  })
})
