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

    it('constructs a signald message from a channel number, recipient, message, and attachments', () => {
      expect(sdMessageOf({ sender, recipient, message, attachments })).to.eql({
        type: 'send',
        username: sender,
        recipientAddress: { number: recipient },
        messageBody: message,
        attachments,
      })
    })

    it('provides an empty attachments array if none is provided', () => {
      expect(sdMessageOf({ sender, recipient, message })).to.eql({
        type: 'send',
        username: sender,
        recipientAddress: { number: recipient },
        messageBody: message,
        attachments: [],
      })
    })
  })
})
