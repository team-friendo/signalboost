import { expect } from 'chai'
import { describe, it } from 'mocha'
import messagesEN from '../../../../app/services/dispatcher/strings/messages/EN'
import messagesES from '../../../../app/services/dispatcher/strings/messages/ES'
import messagesFR from '../../../../app/services/dispatcher/strings/messages/FR'
import { times } from 'lodash'
import { messagesIn } from '../../../../app/services/dispatcher/strings/messages'
import { languages } from '../../../../app/constants'
import { adminMembershipFactory, subscriberMembershipFactory } from "../../../support/factories/membership"

describe('messages module', () => {
  describe('parsing command responses', () => {
    const cr = messagesEN.commandResponses
    const channel = {
      name: 'foobar',
      phoneNumber: '+13333333333',
      memberships: [
        ...times(2, () => adminMembershipFactory({ channelPhoneNumber: '+13333333333' })),
        ...times(2, () => subscriberMembershipFactory({ channelPhoneNumber: '+13333333333' }))
      ],
      messageCount: { broadcastIn: 42 },
    }

    describe('for info command', () => {
      describe('for admin', () => {
        it('shows admin and subscriber counts', () => {
          const msg = cr.info.admin(channel)
          expect(msg).to.include('admins: 2')
          expect(msg).to.include('subscribers: 2')
        })
      })

      describe('for subscriber', () => {
        it('shows subscriber count', () => {
          const msg = cr.info.subscriber(channel)
          expect(msg).to.include('subscribers: 2')
        })
      })
    })
  })

  describe('resolving messages in different languages', () => {
    it('returns default language if handed non-existent language flag', () => {
      expect(messagesIn('FOO')).to.eql(messagesEN)
    })

    it('resolves messages for EN flag', () => {
      expect(messagesIn(languages.EN)).to.eql(messagesEN)
    })

    it('resolves messages for ES flag', () => {
      expect(messagesIn(languages.ES)).to.eql(messagesES)
    })
    
    it('resolves messages for FR flag', () => {
      expect(messagesIn(languages.FR)).to.eql(messagesFR)
    })
  })
})
