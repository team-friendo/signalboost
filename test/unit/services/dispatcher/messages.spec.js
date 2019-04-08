import { expect } from 'chai'
import { describe, it } from 'mocha'
import messages from '../../../../app/services/dispatcher/messages'

import { administrationFactory } from '../../../support/factories/administration'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { times } from 'lodash'

describe('messages', () => {
  describe('command responses', () => {
    const cr = messages.commandResponses
    const channel = {
      name: 'foobar',
      phoneNumber: '+13333333333',
      administrations: times(2, administrationFactory({ channelPhoneNumber: '+13333333333' })),
      subscriptions: times(2, subscriptionFactory({ channelPhoneNumber: '+13333333333' })),
    }

    describe('for info command', () => {
      describe('for admin', () => {
        it('shows admin phone numbers and subscriber count', () => {
          const msg = cr.info.admin(channel)
          expect(msg).to.include(
            `admins: ${channel.administrations.map(a => a.channelPhoneNumber).join(', ')}`,
          )
          expect(msg).to.include('subscribers: 2')
        })
      })

      describe('for subscriber', () => {
        it('shows admin count and subscriber count', () => {
          const msg = cr.info.subscriber(channel)
          expect(msg).to.include('admins: 2')
          expect(msg).to.include('subscribers: 2')
        })
      })
    })
  })
})
