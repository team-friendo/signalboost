import { expect } from 'chai'
import { describe, it } from 'mocha'
import messagesEN from '../../../../app/services/dispatcher/strings/messages/EN'
import messagesES from '../../../../app/services/dispatcher/strings/messages/ES'
import { publicationFactory } from '../../../support/factories/publication'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { times } from 'lodash'
import { messagesIn } from '../../../../app/services/dispatcher/strings/messages'
import { languages } from '../../../../app/constants'

describe('messages module', () => {
  describe('parsing command responses', () => {
    const cr = messagesEN.commandResponses
    const channel = {
      name: 'foobar',
      phoneNumber: '+13333333333',
      publications: times(2, publicationFactory({ channelPhoneNumber: '+13333333333' })),
      subscriptions: times(2, subscriptionFactory({ channelPhoneNumber: '+13333333333' })),
      messageCount: { broadcastIn: 42 },
    }

    describe('for info command', () => {
      describe('for publisher', () => {
        it('shows publisher phone numbers and subscriber count', () => {
          const msg = cr.info.publisher(channel)
          expect(msg).to.include(
            `admins: ${channel.publications.map(a => a.channelPhoneNumber).join(', ')}`,
          )
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
  })
})
