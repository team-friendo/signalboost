import { expect } from 'chai'
import { describe, it } from 'mocha'
import messagesEN from '../../../app/dispatcher/strings/messages/EN'
import messagesES from '../../../app/dispatcher/strings/messages/ES'
import messagesFR from '../../../app/dispatcher/strings/messages/FR'
import messagesDE from '../../../app/dispatcher/strings/messages/DE'
import { memberTypes } from '../../../app/db/repositories/membership'
import { times, keys } from 'lodash'
import { messagesIn } from '../../../app/dispatcher/strings/messages'
import { languages } from '../../../app/language'
import {
  adminMembershipFactory,
  subscriberMembershipFactory,
} from '../../support/factories/membership'
import { genPhoneNumber } from '../../support/factories/phoneNumber'

describe('messages module', () => {
  describe('translations', () => {
    it('translates system name to ES', () => {
      expect(messagesEN.systemName).to.exist
    })
    it('translates system name to FR', () => {
      expect(messagesFR.systemName).to.exist
    })

    keys(messagesEN.commandResponses).forEach(key => {
      keys(messagesEN.commandResponses[key]).forEach(subKey => {
        if (key === 'toggles') {
          keys(messagesEN.commandResponses[key][subKey]).forEach(subSubKey => {
            it(`translates ${key}.${subKey}.${subSubKey} command response to ES`, () => {
              expect(messagesES.commandResponses[key][subKey][subSubKey]).to.exist
            })
            it(`translates ${key}.${subKey}.${subSubKey} command response to FR`, () => {
              expect(messagesFR.commandResponses[key][subKey][subSubKey]).to.exist
            })
            it(`translates ${key}.${subKey}.${subSubKey} command response to DE`, () => {
              expect(messagesDE.commandResponses[key][subKey][subSubKey]).to.exist
            })
          })
        } else {
          it(`translates ${key}.${subKey} command response to ES`, () => {
            expect(messagesES.commandResponses[key][subKey]).to.exist
          })
          it(`translates ${key}.${subKey} command response to FR`, () => {
            expect(messagesFR.commandResponses[key][subKey]).to.exist
          })
          it(`translates ${key}.${subKey} command response to DE`, () => {
            expect(messagesDE.commandResponses[key][subKey]).to.exist
          })
        }
      })
    })

    keys(messagesEN.notifications).forEach(key => {
      it(`translates ${key} notification to ES`, () => {
        expect(messagesES.notifications[key]).to.exist
      })
      it(`translates ${key} notification to FR`, () => {
        expect(messagesFR.notifications[key]).to.exist
      })
      it(`translates ${key} notification to DE`, () => {
        expect(messagesDE.notifications[key]).to.exist
      })
    })
    keys(messagesEN.prefixes).forEach(key => {
      it(`translates ${key} prefix to ES`, () => {
        expect(messagesES.prefixes[key]).to.exist
      })
      it(`translates ${key} prefix to FR`, () => {
        expect(messagesFR.prefixes[key]).to.exist
      })
      it(`translates ${key} prefix to DE`, () => {
        expect(messagesDE.prefixes[key]).to.exist
      })
    })
  })

  describe('command responses with logic', () => {
    const cr = messagesEN.commandResponses
    const channel = {
      phoneNumber: '+13333333333',
      vouchMode: 'ON',
      vouchLevel: 1,
      memberships: [
        ...times(2, () => adminMembershipFactory({ channelPhoneNumber: '+13333333333' })),
        ...times(2, () => subscriberMembershipFactory({ channelPhoneNumber: '+13333333333' })),
      ],
      messageCount: { broadcastIn: 42 },
    }

    describe('for INFO command', () => {
      describe('for admin', () => {
        const msg = cr.info[memberTypes.ADMIN](channel)

        it('shows admin and subscriber counts', () => {
          expect(msg).to.include('admins: 2')
          expect(msg).to.include('subscribers: 2')
        })

        describe('when vouch mode is on', () => {
          it('shows the admin the vouch level', () => {
            expect(msg).to.include('vouching: on')
            expect(msg).to.include('vouch level: 1')
          })
        })
      })

      describe('for subscriber', () => {
        const msg = cr.info[memberTypes.SUBSCRIBER](channel)
        it('does not show subscriber count', () => {
          expect(msg).not.to.include('subscribers: 2')
        })
      })
    })
  })

  describe('notifications with logic', () => {
    const n = messagesEN.notifications

    describe('#hotlineMessagesDisabled', () => {
      describe('when sender is a subscriber', () => {
        it('prompts HELP', () => {
          expect(n.hotlineMessagesDisabled(true)).to.include('HELP')
        })
      })

      describe('when sender is not a subscriber', () => {
        it('prompts HELP and HELLO', () => {
          const notification = n.hotlineMessagesDisabled(false)
          expect(notification).to.include('HELP')
          expect(notification).to.include('HELLO')
        })
      })
    })

    describe('#vouchedInviteReceived', () => {
      describe('when invitee has received enough invites', () => {
        const notification = n.vouchedInviteReceived(2, 2)
        it('prompts them with ACCEPT or DECLINE', () => {
          expect(notification).to.include('ACCEPT or DECLINE')
        })
      })

      describe("when invitee hasn't received enough invites", () => {
        const notification = n.vouchedInviteReceived(1, 2)
        it("doesn't prompt them with ACCEPT or DECLINE", () => {
          expect(notification).not.to.include('ACCEPT or DECLINE')
        })
      })
    })

    describe('#rateLimitOccured', () => {
      const [channelPhoneNumber] = times(2, genPhoneNumber)

      describe('when resend interval is not null', () => {
        it('notifies user of next resend interval', () => {
          expect(n.rateLimitOccurred(channelPhoneNumber, 2000)).to.include('2 sec')
        })

        it('does not notify user of next resend interval', () => {
          expect(n.rateLimitOccurred(channelPhoneNumber, null)).not.to.include('2 sec')
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
    it('resolves messages for DE flag', () => {
      expect(messagesIn(languages.DE)).to.eql(messagesDE)
    })
  })
})
