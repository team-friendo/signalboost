import { expect } from 'chai'
import { describe, it } from 'mocha'
import messagesEN from '../../../../app/services/dispatcher/strings/messages/EN'
import messagesES from '../../../../app/services/dispatcher/strings/messages/ES'
import messagesFR from '../../../../app/services/dispatcher/strings/messages/FR'
import { times } from 'lodash'
import { messagesIn } from '../../../../app/services/dispatcher/strings/messages'
import { languages } from '../../../../app/constants'
import {
  adminMembershipFactory,
  subscriberMembershipFactory,
} from '../../../support/factories/membership'

describe('messages module', () => {
  describe('translations', () => {
    it('translates system name to ES', () => {
      expect(messagesEN.systemName).to.exist
    })
    it('translates system name to FR', () => {
      expect(messagesFR.systemName).to.exist
    })

    Object.keys(messagesEN.commandResponses).forEach(key => {
      it(`translates ${key} command response to ES`, () => {
        expect(messagesES.commandResponses[key]).to.exist
      })
      it(`translates ${key} command response to FR`, () => {
        expect(messagesFR.commandResponses[key]).to.exist
      })
    })

    Object.keys(messagesEN.notifications).forEach(key => {
      it(`translates ${key} notification to ES`, () => {
        expect(messagesES.notifications[key]).to.exist
      })
      it(`translates ${key} notification to FR`, () => {
        expect(messagesFR.notifications[key]).to.exist
      })
    })
    Object.keys(messagesEN.prefixes).forEach(key => {
      it(`translates ${key} prefix to ES`, () => {
        expect(messagesES.prefixes[key]).to.exist
      })
      it(`translates ${key} prefix to FR`, () => {
        expect(messagesFR.prefixes[key]).to.exist
      })
    })
  })

  describe('parsing command responses', () => {
    const cr = messagesEN.commandResponses
    const n = messagesEN.notifications
    const channel = {
      name: 'foobar',
      phoneNumber: '+13333333333',
      memberships: [
        ...times(2, () => adminMembershipFactory({ channelPhoneNumber: '+13333333333' })),
        ...times(2, () => subscriberMembershipFactory({ channelPhoneNumber: '+13333333333' })),
      ],
      messageCount: { broadcastIn: 42 },
    }

    describe('for INFO command', () => {
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

    describe('for incoming message when incoming messages are disabled', () => {
      describe('when sender is a subscriber', () => {
        it('prompts HELP', () => {
          expect(n.hotlineMessagesDisabled(true)).to.include('HELP')
        })
      })
      describe('when hotline message sender is not a subscriber', () => {
        it('prompts HELP and HELLO', () => {
          const notification = n.hotlineMessagesDisabled(false)
          expect(notification).to.include('HELP')
          expect(notification).to.include('HELLO')
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
