import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import { mapValues, merge, sample, times, values } from 'lodash'
import { processCommand } from '../../../../app/dispatcher/commands'
import { commands, toggles, vouchModes } from '../../../../app/dispatcher/commands/constants'
import { statuses } from '../../../../app/util'
import { defaultLanguage, languages } from '../../../../app/language'
import signal from '../../../../app/signal'
import diagnostics from '../../../../app/diagnostics'
import channelRepository, {
  getSubscriberMemberships,
} from '../../../../app/db/repositories/channel'
import banRepository from '../../../../app/db/repositories/ban'
import channelRequestRepository from '../../../../app/db/repositories/channelRequest'
import inviteRepository from '../../../../app/db/repositories/invite'
import membershipRepository, { memberTypes } from '../../../../app/db/repositories/membership'
import deauthorizationRepository from '../../../../app/db/repositories/deauthorization'
import eventRepository from '../../../../app/db/repositories/event'
import hotlineMessageRepository from '../../../../app/db/repositories/hotlineMessage'
import phoneNumberService from '../../../../app/registrar/phoneNumber'
import channelRegistrar from '../../../../app/registrar/channel'
import validator from '../../../../app/db/validations'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { genPhoneNumber, parenthesize } from '../../../support/factories/phoneNumber'
import { sdMessageOf } from '../../../../app/signal/constants'
import {
  adminMembershipFactory,
  membershipFactory,
  subscriberMembershipFactory,
} from '../../../support/factories/membership'
import { messagesIn } from '../../../../app/dispatcher/strings/messages'
import { deauthorizationFactory } from '../../../support/factories/deauthorization'
import { eventFactory } from '../../../support/factories/event'
import { eventTypes } from '../../../../app/db/models/event'
const {
  auth: { maintainerPassphrase },
  signal: { diagnosticsPhoneNumber, supportPhoneNumber },
} = require('../../../../app/config')

describe('executing commands', () => {
  /********************************************************
   * Fancy test setup ahoy! Motivation: we want to usefully assert on distinctions between:
   *
   * (1) the language a command was issued in
   * (2) the language of the recipient of command responses
   * (3) the language of the recipient of notifications
   * (4) the language that a notification, parse error, or command response is ultimately issued in
   *
   * Where all of the above may differ from one another.
   *
   * To do that we:
   *
   * - pick a random language to use for commands issued in each run of this test suite, and assign it to
   *   `language`
   * - import the command mapping for the given language, then call `mapValues` on it to remove all but the
   *   first command variant from the map's value
   * - this yields a map from command keyword to a single command string variant
   *   for use in tests called `localizedCmds`.
   *
   * Usage of `localizedCmds` in TEST SETUP is as follows:
   *
   * - every time you want to issue a command in a setup step, use `localizedCmds.<COMMAND_KEYWORD>`.
   * - this will to generate commands in different languages for every run of this test suite
   * - eg, if `language` is set to `'ES'`, then `localizedCmds.ACCEPT` would genereat `'ACCEPTAR'`
   *
   * We also provide helper functions to generate message strings (command responses, notifications, or parse errors)
   * in either the language of the message recipient's membership or in the langauge the command was issued in
   * (for instances where we can't infer membership of the sender or know they don't have one)
   *
   *********************************************************/

  // generate map of command strings in a random language
  const language = sample(values(languages))
  const localizedCmds = mapValues(
    require(`../../../../app/dispatcher/strings/commands/${language}`),
    commandVariants => commandVariants[0],
  )
  // provide language+member-specific selectors
  const commandResponsesInCommandLang = messagesIn(language).commandResponses
  const parseErrorsInCommandLang = messagesIn(language).parseErrors
  const notificationsInCommandLang = messagesIn(language).notifications
  const commandResponsesFor = sender => messagesIn(sender.language).commandResponses
  const notificationsFor = member => messagesIn(member.language).notifications
  const prefixesFor = member => messagesIn(member.language).prefixes

  const channel = {
    phoneNumber: '+13333333333',
    hotlineOn: true,
    vouchMode: vouchModes.OFF,
    subscriberLimit: 1000,
    deauthorizations: [deauthorizationFactory()],
    memberships: [
      ...times(3, idx =>
        adminMembershipFactory({
          channelPhoneNumber: '+13333333333',
          language: sample(values(languages)),
          adminId: idx + 1,
        }),
      ),
      ...times(2, () =>
        subscriberMembershipFactory({
          channelPhoneNumber: '+13333333333',
          language: sample(values(languages)),
        }),
      ),
    ],
    nextAdminId: 4,
    messageCount: { broadcastIn: 42 },
  }
  const adminMemberships = channel.memberships.slice(0, 3)
  const bystanderAdminMemberships = channel.memberships.slice(1, 3)
  const admin = {
    ...channel.memberships[0],
    phoneNumber: channel.memberships[0].memberPhoneNumber,
  }
  const subscriber = {
    ...channel.memberships[3],
    phoneNumber: channel.memberships[3].memberPhoneNumber,
  }

  const randomPerson = {
    memberPhoneNumber: genPhoneNumber(),
    type: memberTypes.NONE,
    language,
  }
  const newAdminPhoneNumber = genPhoneNumber()
  const newAdminMembership = adminMembershipFactory({
    channelPhoneNumber: channel.phoneNumber,
    memberPhoneNumber: newAdminPhoneNumber,
    language: 'FR',
    adminId: channel.nextAdminId,
  })
  const rawNewAdminPhoneNumber = parenthesize(newAdminPhoneNumber)
  const deauthorizedPhoneNumber = channel.deauthorizations[0].memberPhoneNumber

  const attachments = [{ filename: 'some/path', width: 42, height: 42, voiceNote: false }]

  let logIfFirstMembershipStub, logIfLastMembershipStub

  beforeEach(() => {
    sinon.stub(hotlineMessageRepository, 'getMessageId').returns(Promise.resolve('42'))
    logIfFirstMembershipStub = sinon
      .stub(eventRepository, 'logIfFirstMembership')
      .returns(Promise.resolve(sample([null, eventFactory(eventTypes.MEMBER_CREATED)])))
    logIfLastMembershipStub = sinon
      .stub(eventRepository, 'logIfLastMembership')
      .returns(Promise.resolve(sample([null, eventFactory(eventTypes.MEMBER_DESTROYED)])))
  })
  afterEach(() => sinon.restore())

  describe('ACCEPT command', () => {
    const inviter = membershipFactory()
    const dispatchable = {
      channel: { ...channel, vouchMode: 'ON', vouchLevel: 1 },
      sender: randomPerson,
      sdMessage: sdMessageOf({ sender: channel.phoneNumber, message: localizedCmds.ACCEPT }),
    }
    let isMemberStub, countInvitesStub, acceptStub, findInviterStub
    beforeEach(() => {
      isMemberStub = sinon.stub(membershipRepository, 'isMember')
      countInvitesStub = sinon.stub(inviteRepository, 'count')
      acceptStub = sinon.stub(inviteRepository, 'accept')
      findInviterStub = sinon.stub(inviteRepository, 'findInviter')
    })

    describe('when channel has reached its subscriber limit', () => {
      const subscriberLimit = getSubscriberMemberships(channel).length
      const _dispatchable = merge({}, dispatchable, { channel: { subscriberLimit } })

      it('returns an ERROR status', async () => {
        expect(await processCommand(_dispatchable)).to.eql({
          command: commands.ACCEPT,
          payload: '',
          status: statuses.ERROR,
          message: commandResponsesFor(randomPerson).accept.subscriberLimitReached(subscriberLimit),
          notifications: [],
        })
      })
    })

    describe('when sender is already member of channel', () => {
      beforeEach(() => isMemberStub.returns(Promise.resolve(true)))
      it('returns an ERROR status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.ACCEPT,
          payload: '',
          status: statuses.ERROR,
          message: commandResponsesFor(randomPerson).accept.alreadyMember,
          notifications: [],
        })
      })
    })

    describe('when sender is not already member of channel', () => {
      beforeEach(() => isMemberStub.returns(Promise.resolve(false)))

      describe('when vouch mode is ON', () => {
        describe('when sender lacks sufficient invites', () => {
          // vouch level is 1 by default; accepter possesses 0 invites
          beforeEach(() => countInvitesStub.returns(Promise.resolve(0)))

          it('returns an ERROR status', async () => {
            const { channel } = dispatchable
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.ACCEPT,
              payload: '',
              status: statuses.ERROR,
              message: commandResponsesInCommandLang.accept.belowVouchLevel(channel.vouchLevel, 0),
              notifications: [],
            })
          })
        })

        describe('when sender has sufficient invites', () => {
          describe('when accept db calls succeed', () => {
            beforeEach(() => {
              findInviterStub.returns(Promise.resolve(inviter))
              acceptStub.returns(Promise.resolve([membershipFactory(), 1]))
            })

            it('returns SUCCESS status', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.ACCEPT,
                payload: '',
                status: statuses.SUCCESS,
                message: commandResponsesInCommandLang.accept.success,
                notifications: [
                  {
                    recipient: inviter.memberPhoneNumber,
                    message: notificationsFor(inviter).inviteAccepted(
                      randomPerson.memberPhoneNumber,
                    ),
                  },
                ],
              })
            })
          })

          describe('when accept db call fails', () => {
            beforeEach(() => acceptStub.callsFake(() => Promise.reject(new Error('boom!'))))

            it('returns ERROR status', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.ACCEPT,
                payload: '',
                status: statuses.ERROR,
                message: messagesIn(randomPerson.language).commandResponses.accept.dbError,
                notifications: [],
              })
            })
          })

          describe('when inviter no longer exists', () => {
            beforeEach(() => {
              findInviterStub.returns(Promise.resolve(null))
              acceptStub.returns(Promise.resolve([membershipFactory(), 1]))
            })

            it('does not return acceptance notifcation', async () => {
              expect((await processCommand(dispatchable)).notifications).to.eql([])
            })
          })
        })
      })

      describe('when vouch mode is OFF and user has no invites', () => {
        const _dispatchable = { ...dispatchable, channel }
        beforeEach(() => countInvitesStub.returns(Promise.resolve(0)))

        describe('when accept db calls succeed', () => {
          beforeEach(() => {
            findInviterStub.returns(Promise.resolve(inviter))
            acceptStub.returns(Promise.resolve([membershipFactory(), 1]))
          })

          it('logs membership creation (if applicable)', async () => {
            await processCommand(_dispatchable)
            expect(logIfFirstMembershipStub.callCount).to.eql(1)
            expect(logIfFirstMembershipStub.getCall(0).args).to.eql([
              randomPerson.memberPhoneNumber,
            ])
          })

          it('returns SUCCESS status', async () => {
            expect(await processCommand(_dispatchable)).to.eql({
              command: commands.ACCEPT,
              payload: '',
              status: statuses.SUCCESS,
              message: commandResponsesInCommandLang.accept.success,
              notifications: [
                {
                  recipient: inviter.memberPhoneNumber,
                  message: notificationsFor(inviter).inviteAccepted(randomPerson.memberPhoneNumber),
                },
              ],
            })
          })
        })

        describe('when accept db call fails', () => {
          beforeEach(() => acceptStub.callsFake(() => Promise.reject(new Error('boom!'))))

          it('returns ERROR status', async () => {
            expect(await processCommand(_dispatchable)).to.eql({
              command: commands.ACCEPT,
              payload: '',
              status: statuses.ERROR,
              message: messagesIn(randomPerson.language).commandResponses.accept.dbError,
              notifications: [],
            })
          })
        })
      })
    })

    describe('when there is an error retrieving membership status', () => {
      beforeEach(() => isMemberStub.callsFake(() => Promise.reject(new Error('boom!'))))

      it('returns ERROR status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.ACCEPT,
          payload: '',
          status: statuses.ERROR,
          message: commandResponsesInCommandLang.accept.dbError,
          notifications: [],
        })
      })
    })

    describe('when there is an error counting invites', () => {
      beforeEach(() => {
        isMemberStub.returns(Promise.resolve(false))
        countInvitesStub.callsFake(() => Promise.reject(new Error('boom!')))
      })

      it('returns ERROR status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.ACCEPT,
          payload: '',
          status: statuses.ERROR,
          message: commandResponsesInCommandLang.accept.dbError,
          notifications: [],
        })
      })
    })
  })

  describe('ADD command', () => {
    let addAdminStub, trustStub, destroyDeauthStub, isBannedStub
    beforeEach(() => {
      addAdminStub = sinon.stub(membershipRepository, 'addAdmin')
      trustStub = sinon.stub(signal, 'trust')
      destroyDeauthStub = sinon.stub(deauthorizationRepository, 'destroy')
      isBannedStub = sinon.stub(banRepository, 'isBanned').returns(Promise.resolve(false))
    })

    describe('when sender is an admin', () => {
      const sender = admin

      describe('when payload is a valid phone number', () => {
        const sdMessage = sdMessageOf({
          sender: channel,
          message: `${localizedCmds.ADD} ${rawNewAdminPhoneNumber}`,
        })
        // to simulate situation in which we have not yet added the admin...
        const _channel = { ...channel, memberships: channel.memberships.slice(1) }
        const dispatchable = { channel: _channel, sender, sdMessage }

        beforeEach(() => addAdminStub.returns(Promise.resolve()))

        it("attempts to add payload number to the channel's admins", async () => {
          await processCommand(dispatchable)
          expect(addAdminStub.getCall(0).args).to.eql([channel.phoneNumber, newAdminPhoneNumber])
        })

        describe('when new admin has not been previously deauthorized', () => {
          describe('when adding the admin succeeds', () => {
            beforeEach(() => addAdminStub.returns(Promise.resolve(newAdminMembership)))

            it('returns a SUCCESS status, message, and notifications', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.ADD,
                payload: newAdminPhoneNumber,
                status: statuses.SUCCESS,
                message: commandResponsesFor(sender).add.success(newAdminMembership),
                notifications: [
                  // welcome message to newly added admin
                  {
                    recipient: newAdminPhoneNumber,
                    message: messagesIn(languages.FR).notifications.welcome(
                      sender.memberPhoneNumber,
                      channel.phoneNumber,
                    ),
                  },
                  // notifications for all bystander admins
                  {
                    recipient: channel.memberships[1].memberPhoneNumber,
                    message: `[${
                      prefixesFor(channel.memberships[1]).notificationHeader
                    }]\n${notificationsFor(channel.memberships[1]).adminAdded(
                      sender.adminId,
                      newAdminMembership.adminId,
                    )}`,
                  },
                  {
                    recipient: channel.memberships[2].memberPhoneNumber,
                    message: `[${
                      prefixesFor(channel.memberships[2]).notificationHeader
                    }]\n${notificationsFor(channel.memberships[2]).adminAdded(
                      sender.adminId,
                      newAdminMembership.adminId,
                    )}`,
                  },
                ],
              })
            })

            it('logs membership creation (if applicable)', async () => {
              await processCommand(dispatchable)
              expect(logIfFirstMembershipStub.callCount).to.eql(1)
              expect(logIfFirstMembershipStub.getCall(0).args).to.eql([newAdminPhoneNumber])
            })
          })

          describe('when adding the admin fails', () => {
            beforeEach(() => addAdminStub.callsFake(() => Promise.reject('oh noes!')))

            it('returns an ERROR status and message', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.ADD,
                payload: newAdminPhoneNumber,
                status: statuses.ERROR,
                message: commandResponsesFor(sender).add.dbError(newAdminPhoneNumber),
                notifications: [],
              })
            })
          })
        })

        describe('when new admin has been previously deauthorized', () => {
          const sdMessage = sdMessageOf({
            sender: channel,
            message: `${localizedCmds.ADD} ${deauthorizedPhoneNumber}`,
          })
          const dispatchable = { channel, sender, sdMessage }

          it("attempts to trust the admin's new fingerprint", async () => {
            await processCommand(dispatchable).catch()
            expect(trustStub.callCount).to.eql(1)
          })

          describe('when trusting fingerprint succeeds', () => {
            beforeEach(() => trustStub.returns(Promise.resolve()))

            it('attempts to remove the deauthorization record for the new admin', async () => {
              await processCommand(dispatchable).catch()
              expect(destroyDeauthStub.callCount).to.eql(1)
            })

            describe('when removing deauthorization record succeeds', () => {
              beforeEach(() => destroyDeauthStub.returns(Promise.resolve(1)))

              describe('when adding new admin succeeds', () => {
                beforeEach(() =>
                  addAdminStub.callsFake((_, chPnum, adminPnum) =>
                    Promise.resolve(
                      adminMembershipFactory({
                        channelPhoneNumber: chPnum,
                        memberPhoneNumber: adminPnum,
                        language,
                      }),
                    ),
                  ),
                )
                // note: we only test the happy path as failure path of this branch is tested exhaustively above

                it('returns a SUCCESS status, message, and notifications', async () => {
                  const result = await processCommand(dispatchable)
                  expect(result.status).to.eql(statuses.SUCCESS)
                  expect(result.message).to.eql(
                    commandResponsesFor(sender).add.success(deauthorizedPhoneNumber),
                  )
                  expect(result.notifications.length).to.eql(3)
                })
              })
            })
          })
        })

        describe('when phone number to be added has been banned', () => {
          beforeEach(() => isBannedStub.returns(Promise.resolve(true)))

          it('returns an error status', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.ADD,
              payload: newAdminPhoneNumber,
              status: statuses.ERROR,
              message: commandResponsesFor(sender).add.banned(newAdminPhoneNumber),
              notifications: [],
            })
          })
        })
      })

      describe('when payload is not a valid phone number', async () => {
        const dispatchable = {
          channel,
          sender,
          sdMessage: sdMessageOf({ sender: channel, message: `${localizedCmds.ADD} foo` }),
        }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not attempt to add admin', () => {
          expect(addAdminStub.callCount).to.eql(0)
        })

        it('returns a ERROR status/message', () => {
          expect(result).to.eql({
            command: commands.ADD,
            payload: '',
            status: statuses.ERROR,
            message: messagesIn(language).parseErrors.invalidPhoneNumber('foo'),
            notifications: [],
          })
        })
      })
    })

    describe('when sender is not an admin', () => {
      it('does not attempt to add admin', async () => {
        const dispatchable = {
          channel,
          sender: subscriber,
          sdMessage: sdMessageOf({ sender: channel, message: `ADD ${newAdminPhoneNumber}` }),
        }
        await processCommand(dispatchable)
        expect(addAdminStub.callCount).to.eql(0)
      })
    })
  })

  describe('BAN command', () => {
    const messageId = 1312
    let isBannedStub, findMemberPhoneNumberStub, banMemberStub
    beforeEach(() => {
      findMemberPhoneNumberStub = sinon.stub(hotlineMessageRepository, 'findMemberPhoneNumber')
      isBannedStub = sinon.stub(banRepository, 'isBanned')
      banMemberStub = sinon.stub(banRepository, 'banMember')
    })

    describe('when hotline message could not be found', () => {
      beforeEach(() => {
        class HotlineMessageIdMissingError extends Error {
          constructor(message) {
            super(message)
            this.name = 'HotlineMessageIdMissingError'
          }
        }
        findMemberPhoneNumberStub.returns(Promise.reject(new HotlineMessageIdMissingError('error')))
      })

      it('returns ERROR doesNotExist', async () => {
        const dispatchable = {
          channel,
          sender: { ...admin, language: languages.EN },
          sdMessage: sdMessageOf({
            sender: channel.phoneNumber,
            message: 'BAN @1312',
            attachments,
          }),
        }

        expect(await processCommand(dispatchable)).to.eql({
          command: commands.BAN,
          status: statuses.ERROR,
          message:
            'The sender of this hotline message is inactive, so we no longer store their message records. Please try again once they message again.',
          notifications: [],
          payload: { messageId: 1312, reply: '' },
        })
      })
    })

    describe('when there was a generic error', () => {
      beforeEach(() => {
        findMemberPhoneNumberStub.returns(Promise.reject(new Error('woops database')))
      })

      it('returns ERROR doesNotExist', async () => {
        const dispatchable = {
          channel,
          sender: { ...admin, language: languages.EN },
          sdMessage: sdMessageOf({
            sender: channel.phoneNumber,
            message: 'BAN @1312',
            attachments,
          }),
        }

        expect(await processCommand(dispatchable)).to.eql({
          command: commands.BAN,
          status: statuses.ERROR,
          message: 'Oops! Failed to issue ban. Please try again!',
          notifications: [],
          payload: { messageId: 1312, reply: '' },
        })
      })
    })

    describe('when member is already banned', () => {
      beforeEach(() => {
        findMemberPhoneNumberStub.returns(Promise.resolve(subscriber.phoneNumber))
        isBannedStub.returns(Promise.resolve(true))
      })

      it('returns ERROR alreadybanned', async () => {
        const dispatchable = {
          channel,
          sender: { ...admin, language: languages.EN },
          sdMessage: sdMessageOf({
            sender: channel.phoneNumber,
            message: 'BAN @1312',
            attachments,
          }),
        }

        expect(await processCommand(dispatchable)).to.eql({
          command: commands.BAN,
          status: statuses.ERROR,
          message: `The sender of hotline message ${messageId} is already banned.`,
          notifications: [],
          payload: { messageId: 1312, reply: '' },
        })
      })
    })

    describe('when member is not already banned', () => {
      beforeEach(() => {
        findMemberPhoneNumberStub.returns(Promise.resolve(subscriber.phoneNumber))
        isBannedStub.returns(Promise.resolve(false))
        banMemberStub.returns(Promise.resolve())
      })

      it('returns SUCCESS with notifications for admins and banned member', async () => {
        const dispatchable = {
          channel,
          sender: { ...admin, language: languages.EN },
          sdMessage: sdMessageOf({
            sender: channel.phoneNumber,
            message: 'BAN @1312',
            attachments,
          }),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.BAN,
          status: statuses.SUCCESS,
          message: 'The sender of hotline message 1312 has been banned.',
          notifications: [
            {
              recipient: subscriber.phoneNumber,
              message:
                'An admin of this channel has banned you. Any further interaction will not be received by the admins of the channel.',
            },
            ...bystanderAdminMemberships.map(membership => ({
              recipient: membership.memberPhoneNumber,
              message: `[${prefixesFor(membership).notificationHeader}]\n${messagesIn(
                membership.language,
              ).notifications.banIssued(admin.adminId, 1312)}`,
            })),
          ],
          payload: { messageId: 1312, reply: '' },
        })
      })
    })
  })

  describe('BROADCAST command', () => {
    const sdMessage = sdMessageOf({
      sender: channel.phoneNumber,
      message: `${localizedCmds.BROADCAST} hello friendos!`,
      attachments,
    })

    describe('when sender is an admin', () => {
      const sender = admin
      const dispatchable = { channel, sender, sdMessage }

      it('returns a SUCCESS status and notifications', async () => {
        const adminMemberships = channel.memberships.slice(0, 3)
        const subscriberMemberships = channel.memberships.slice(3)

        expect(await processCommand(dispatchable)).to.eql({
          command: commands.BROADCAST,
          payload: 'hello friendos!',
          message: '',
          status: statuses.SUCCESS,
          notifications: [
            ...adminMemberships.map(membership => {
              return {
                recipient: membership.memberPhoneNumber,
                message: `[${prefixesFor(membership).broadcastMessage} ${
                  prefixesFor(membership).fromAdmin
                } ${sender.adminId}]\nhello friendos!`,
                attachments,
              }
            }),
            ...subscriberMemberships.map(membership => ({
              recipient: membership.memberPhoneNumber,
              message: `hello friendos!`,
              attachments,
            })),
          ],
        })
      })
    })
  })

  // CHANNEL
  describe('CHANNEL command', () => {
    describe('when sent on the support channel', () => {
      const newAdminPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
      const message = `${localizedCmds.CHANNEL} ${newAdminPhoneNumbers.join(',')}`
      const supportChannel = { ...channel, phoneNumber: supportPhoneNumber }
      const dispatchable = {
        channel: supportChannel,
        sender: randomPerson,
        sdMessage: sdMessageOf({
          sender: supportChannel,
          message,
        }),
      }

      describe('when sent a valid channel request', () => {
        let createChannelStub, addToWaitListStub
        beforeEach(() => {
          createChannelStub = sinon.stub(channelRegistrar, 'create')
          addToWaitListStub = sinon.stub(channelRequestRepository, 'addToWaitlist')
        })

        describe('when creating a new channel succeeds', () => {
          const phoneNumber = genPhoneNumber()

          beforeEach(() => {
            createChannelStub.returns(Promise.resolve({ ...channel, phoneNumber }))
          })

          it('passes in the admin phone numbers to the channel creation request', async () => {
            await processCommand(dispatchable)

            expect(createChannelStub.getCall(0).args).to.eql([newAdminPhoneNumbers])
          })

          it("returns a success status and message containing the new channel's phone number", async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.CHANNEL,
              payload: '',
              status: statuses.SUCCESS,
              message: commandResponsesFor(randomPerson).channel.success(phoneNumber),
              notifications: [],
            })
          })
        })

        describe('when creating the channel fails', () => {
          describe('when there are no available channels', () => {
            beforeEach(async () => {
              createChannelStub.returns(
                Promise.resolve({
                  status: statuses.UNAVAILABLE,
                  error: 'No available phone numbers!',
                  request: { newAdminPhoneNumbers },
                }),
              )
              await processCommand(dispatchable)
            })

            it('adds the new admins to the waitlist', () => {
              expect(addToWaitListStub.getCall(0).args).to.have.deep.members([newAdminPhoneNumbers])
            })

            it('returns an error status and wailist notification', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.CHANNEL,
                status: statuses.ERROR,
                payload: '',
                message: commandResponsesFor(randomPerson).channel.requestsClosed,
                notifications: [],
              })
            })
          })

          describe('when creating the channel produces a handled error', () => {
            beforeEach(() =>
              createChannelStub.returns(
                Promise.resolve({
                  status: statuses.ERROR,
                  error: 'Something random happened!',
                  request: { newAdminPhoneNumbers },
                }),
              ),
            )

            it('returns an error status and message', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.CHANNEL,
                payload: '',
                status: statuses.ERROR,
                message: commandResponsesFor(randomPerson).channel.error,
                notifications: [],
              })
            })
          })

          describe('when creating the channel throws', () => {
            beforeEach(() => createChannelStub.callsFake(() => Promise.reject(new Error('oops'))))

            it('returns an error status and message', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.CHANNEL,
                payload: '',
                status: statuses.ERROR,
                message: commandResponsesFor(randomPerson).channel.error,
                notifications: [],
              })
            })
          })
        })
      })
    })

    describe('when not sent on the support channel', () => {
      const message = `${localizedCmds.CHANNEL} for the secure comms!`
      const sdMessage = sdMessageOf({ sender: channel, message })

      describe('when sender is an admin', () => {
        const dispatchable = { channel, sender: admin, sdMessage }

        it('returns an ERROR status and unnecessary payload message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.CHANNEL,
            payload: '',
            status: statuses.ERROR,
            message: commandResponsesFor(admin).none.error,
            notifications: [],
          })
        })
      })

      describe('when sender is a subscriber', () => {
        const dispatchable = { channel, sender: subscriber, sdMessage }

        it('returns a success status and hotline notifications', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.NONE,
            payload: '',
            status: statuses.SUCCESS,
            message: notificationsFor(subscriber).hotlineMessageSent,
            notifications: [
              {
                recipient: adminMemberships[0].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[0].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
              {
                recipient: adminMemberships[1].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[1].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
              {
                recipient: adminMemberships[2].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[2].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
            ],
          })
        })
      })

      describe('when sender is a random person', () => {
        const dispatchable = { channel, sender: randomPerson, sdMessage }

        it('sends a subscriber help message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.NONE,
            payload: '',
            status: statuses.SUCCESS,
            message: notificationsFor(randomPerson).hotlineMessageSent,
            notifications: [
              {
                recipient: adminMemberships[0].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[0].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
              {
                recipient: adminMemberships[1].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[1].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
              {
                recipient: adminMemberships[2].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[2].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
            ],
          })
        })
      })
    })
  })

  describe('DECLINE command', () => {
    const dispatchable = {
      channel,
      sender: randomPerson,
      sdMessage: sdMessageOf({ sender: channel.phoneNumber, message: localizedCmds.DECLINE }),
    }

    let declineStub
    beforeEach(() => (declineStub = sinon.stub(inviteRepository, 'decline')))

    describe('when db call succeeds', () => {
      beforeEach(() => declineStub.returns(Promise.resolve(1)))

      it('returns a SUCCESS status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.DECLINE,
          payload: '',
          status: statuses.SUCCESS,
          message: commandResponsesInCommandLang.decline.success,
          notifications: [],
        })
      })
    })

    describe('when db call fails', () => {
      beforeEach(() => declineStub.callsFake(() => Promise.reject(new Error('boom!'))))

      it('returns an ERROR status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.DECLINE,
          payload: '',
          status: statuses.ERROR,
          message: commandResponsesInCommandLang.decline.dbError,
          notifications: [],
        })
      })
    })
  })

  describe('DESTROY command', () => {
    const _dispatchable = {
      channel,
      sdMessage: sdMessageOf({ sender: channel, message: localizedCmds.DESTROY }),
    }

    describe('when issuer is an admin', () => {
      const dispatchable = { ..._dispatchable, sender: admin }

      it('responds with a confirmation prompt', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.DESTROY,
          status: statuses.SUCCESS,
          message: commandResponsesFor(admin).destroy.confirm,
          payload: '',
          notifications: [],
        })
      })
    })
  })

  describe('DESTROY_CONFIRM command', () => {
    const _dispatchable = {
      channel,
      sdMessage: sdMessageOf({ sender: channel, message: localizedCmds.DESTROY_CONFIRM }),
    }

    let destroyStub
    beforeEach(() => (destroyStub = sinon.stub(phoneNumberService, 'destroy')))

    describe('when issuer is an admin', () => {
      const dispatchable = { ..._dispatchable, sender: admin }

      describe('in all cases', () => {
        beforeEach(() => destroyStub.returns(Promise.resolve()))

        it('attempts to destroy the channel', async () => {
          const count = destroyStub.callCount
          await processCommand(dispatchable)
          expect(destroyStub.callCount).to.above(count)
        })
      })

      describe('when destroy succeeds', () => {
        beforeEach(() => destroyStub.returns(Promise.resolve({ status: 'SUCCESS' })))

        it('returns a SUCCESS status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.DESTROY_CONFIRM,
            payload: '',
            status: statuses.SUCCESS,
            message: commandResponsesFor(admin).destroy.success,
            notifications: [],
          })
        })
      })

      describe('when a failure occurs', () => {
        beforeEach(() => destroyStub.returns(Promise.resolve({ status: 'ERROR' })))

        it('returns a ERROR status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.DESTROY_CONFIRM,
            payload: '',
            status: statuses.ERROR,
            message: commandResponsesFor(admin).destroy.error,
            notifications: [],
          })
        })
      })
    })

    describe('when issuer is a subscriber or rando', () => {
      ;[subscriber, randomPerson].forEach(sender => {
        const dispatchable = { ..._dispatchable, sender }
        let callCount

        beforeEach(async () => {
          callCount = destroyStub.callCount
          await processCommand(dispatchable)
        })

        it('does not attempt to destroy the channel', () => {
          expect(destroyStub.callCount).to.eql(callCount)
        })
      })
    })
  })

  describe('HELP command', () => {
    const sdMessage = sdMessageOf({ sender: channel, message: localizedCmds.HELP })

    describe('when sender is an admin', () => {
      const dispatchable = { channel, sender: admin, sdMessage }

      it('sends a help message to sender', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.HELP,
          payload: '',
          status: statuses.SUCCESS,
          message: commandResponsesFor(admin).help.admin,
          notifications: [],
        })
      })
    })

    describe('when sender is a subscriber', () => {
      const dispatchable = { channel, sender: subscriber, sdMessage }

      it('sends a help message to sender', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.HELP,
          payload: '',
          status: statuses.SUCCESS,
          message: commandResponsesFor(subscriber).help.subscriber,
          notifications: [],
        })
      })
    })

    describe('when sender is a random person', () => {
      const dispatchable = { channel, sender: randomPerson, sdMessage }

      it('sends a subscriber help message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.HELP,
          payload: '',
          status: statuses.SUCCESS,
          message: commandResponsesFor(randomPerson).help.subscriber,
          notifications: [],
        })
      })
    })
  })

  describe('INFO command', () => {
    const sdMessage = sdMessageOf({ sender: channel.phoneNumber, message: localizedCmds.INFO })

    describe('when sender is an admin', () => {
      const dispatchable = { channel, sender: admin, sdMessage }

      it('sends an info message with more information', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          payload: '',
          status: statuses.SUCCESS,
          message: commandResponsesFor(admin).info[memberTypes.ADMIN](channel),
          notifications: [],
        })
      })
    })

    describe('when sender is a subscriber', () => {
      const dispatchable = { channel, sender: subscriber, sdMessage }

      it('sends an info message with less information', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          payload: '',
          status: statuses.SUCCESS,
          message: commandResponsesFor(subscriber).info[memberTypes.SUBSCRIBER](channel),
          notifications: [],
        })
      })
    })

    describe('when sender is neither admin nor subscriber', () => {
      const dispatchable = { channel, sender: randomPerson, sdMessage }

      it('sends a subscriber info message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          payload: '',
          status: statuses.SUCCESS,
          message: commandResponsesFor(randomPerson).info[memberTypes.NONE](channel),
          notifications: [],
        })
      })
    })
  })

  // INVITE
  describe('INVITE command', () => {
    const inviteePhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
    const sdMessage = sdMessageOf({
      sender: channel,
      message: `${localizedCmds.INVITE} ${inviteePhoneNumbers.join(',')}`,
    })

    let isMemberStub, issueInviteStub, countInvitesStub, findBannedStub
    beforeEach(() => {
      isMemberStub = sinon.stub(membershipRepository, 'isMember')
      issueInviteStub = sinon.stub(inviteRepository, 'issue')
      countInvitesStub = sinon.stub(inviteRepository, 'count')
      findBannedStub = sinon.stub(banRepository, 'findBanned').returns(Promise.resolve([]))
    })

    describe('when invites would cause channel to exceed subscriber limit', () => {
      const subscriberCount = getSubscriberMemberships(channel).length
      const subscriberLimit = subscriberCount + 1
      const dispatchable = { channel: { ...channel, subscriberLimit }, sdMessage, sender: admin }

      it('returns an ERROR status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INVITE,
          payload: inviteePhoneNumbers,
          status: statuses.ERROR,
          message: commandResponsesFor(admin).invite.subscriberLimitReached(
            inviteePhoneNumbers.length,
            subscriberLimit,
            subscriberCount,
          ),
          notifications: [],
        })
      })
    })

    describe('when invitee is banned', () => {
      const dispatchable = { sdMessage, channel, sender: admin }
      beforeEach(() => findBannedStub.returns(Promise.resolve([inviteePhoneNumbers[0]])))

      it('returns an ERROR status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INVITE,
          payload: inviteePhoneNumbers,
          status: statuses.ERROR,
          message: commandResponsesFor(admin).invite.bannedInvitees(inviteePhoneNumbers[0]),
          notifications: [],
        })
      })
    })

    // VOUCHING_ON
    describe('when vouch mode is ON', () => {
      const vouchingOnChannel = { ...channel, vouchMode: vouchModes.ON, vouchLevel: 1 }

      describe('when sender is not a member of the channel', () => {
        const dispatchable = { sdMessage, channel: vouchingOnChannel, sender: randomPerson }

        it('returns UNAUTHORIZED', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.INVITE,
            payload: inviteePhoneNumbers,
            status: statuses.UNAUTHORIZED,
            message: commandResponsesFor(randomPerson).invite.notSubscriber,
            notifications: [],
          })
        })
      })

      describe('when sender is an admin', () => {
        describe('when at least one invitee phone number is invalid', () => {
          const dispatchable = {
            sdMessage: sdMessageOf({
              sender: channel,
              message: `INVITE foo, ${inviteePhoneNumbers[0]}`,
            }),
            channel: vouchingOnChannel,
            sender: admin,
          }

          it('returns ERROR', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.INVITE,
              payload: '',
              status: statuses.ERROR,
              message: messagesIn(defaultLanguage).parseErrors.invalidPhoneNumber('foo'),
              notifications: [],
            })
          })
        })

        describe('when all invitee numbers are valid (and unique)', () => {
          const dispatchable = { sdMessage, channel: vouchingOnChannel, sender: admin }

          describe('when all invitees are already subscribers', () => {
            let res
            beforeEach(async () => {
              isMemberStub.returns(Promise.resolve(true))
              res = await processCommand(dispatchable)
            })

            it('does not attempt to issue invites', () => {
              expect(issueInviteStub.callCount).to.eql(0)
            })

            it('returns SUCCESS status/message, but no notifications', () => {
              expect(res).to.eql({
                command: commands.INVITE,
                payload: inviteePhoneNumbers,
                status: statuses.SUCCESS,
                message: commandResponsesFor(admin).invite.success(2),
                notifications: [],
              })
            })
          })

          describe('when all invitees are not yet subscribers', () => {
            beforeEach(() => isMemberStub.returns(Promise.resolve(false)))

            describe('when all invitees have already been invited to channel', () => {
              describe('when sending invites succeeds', () => {
                let res
                beforeEach(async () => {
                  issueInviteStub.returns(Promise.resolve(false))
                  res = await processCommand(dispatchable)
                })

                it('attempts to issue invites', () => {
                  expect(issueInviteStub.callCount).to.eql(2)
                })

                it('returns SUCCESS but no payload', () => {
                  expect(res).to.eql({
                    command: commands.INVITE,
                    payload: inviteePhoneNumbers,
                    status: statuses.SUCCESS,
                    message: commandResponsesFor(admin).invite.success(2),
                    notifications: [],
                  })
                })
              })

              describe('when db errors occur issuing invites', () => {
                let res
                beforeEach(async () => {
                  issueInviteStub.onCall(0).returns(Promise.resolve(1))
                  issueInviteStub.onCall(1).callsFake(() => Promise.reject(new Error('boom!')))
                  res = await processCommand(dispatchable)
                })

                it('returns ERROR specifying which phone numbers failed but still notifies successful invites', () => {
                  expect(res).to.eql({
                    command: commands.INVITE,
                    payload: inviteePhoneNumbers,
                    status: statuses.ERROR,
                    message: commandResponsesFor(admin).invite.dbErrors(
                      [inviteePhoneNumbers[1]],
                      inviteePhoneNumbers.length,
                    ),
                    notifications: [
                      {
                        recipient: inviteePhoneNumbers[0],
                        message: notificationsInCommandLang.inviteReceived,
                      },
                    ],
                  })
                })
              })
            })

            describe('when all invitees are not yet invited', () => {
              let res
              beforeEach(async () => {
                issueInviteStub.returns(Promise.resolve(true))
                countInvitesStub.returns(Promise.resolve(1))
                res = await processCommand(dispatchable)
              })

              it('attempts to issue invites', () => {
                expect(issueInviteStub.callCount).to.eql(2)
              })

              it('returns SUCCESS and notifications for each invitee', () => {
                expect(res).to.eql({
                  command: commands.INVITE,
                  payload: inviteePhoneNumbers,
                  status: statuses.SUCCESS,
                  message: commandResponsesFor(admin).invite.success(2),
                  notifications: [
                    {
                      recipient: inviteePhoneNumbers[0],
                      message: notificationsInCommandLang.inviteReceived,
                    },
                    {
                      recipient: inviteePhoneNumbers[1],
                      message: notificationsInCommandLang.inviteReceived,
                    },
                  ],
                })
              })
            })
          })
        })

        describe('when given duplicate invitee phone numbers', () => {
          const _sdMessage = {
            ...sdMessage,
            messageBody: `${localizedCmds.INVITE} ${inviteePhoneNumbers.join(
              ', ',
            )}, ${inviteePhoneNumbers.join(', ')}`,
          }
          const dispatchable = {
            sdMessage: _sdMessage,
            channel: vouchingOnChannel,
            sender: admin,
          }

          describe('when all invitees are not yet subscribed or invited', () => {
            let res
            beforeEach(async () => {
              issueInviteStub.returns(Promise.resolve(true))
              countInvitesStub.returns(Promise.resolve(1))
              res = await processCommand(dispatchable)
            })

            it('only issues one invite per phone number', () => {
              expect(issueInviteStub.callCount).to.eql(2)
            })

            it('only sends one notification per phone number', () => {
              expect(res).to.eql({
                command: commands.INVITE,
                payload: [...inviteePhoneNumbers, ...inviteePhoneNumbers],
                status: statuses.SUCCESS,
                message: commandResponsesFor(admin).invite.success(2),
                notifications: [
                  {
                    recipient: inviteePhoneNumbers[0],
                    message: notificationsInCommandLang.inviteReceived,
                  },
                  {
                    recipient: inviteePhoneNumbers[1],
                    message: notificationsInCommandLang.inviteReceived,
                  },
                ],
              })
            })
          })
        })

        describe('when sending INVITE in a different language', () => {
          // sender's language is English but they're issuing an invite in Spanish

          const dispatchable = {
            sdMessage: sdMessageOf({
              sender: channel.phoneNumber,
              message: `INVITAR ${inviteePhoneNumbers[0]}`,
            }),
            channel: vouchingOnChannel,
            sender: { ...admin, language: languages.EN },
          }

          let res
          beforeEach(async () => {
            issueInviteStub.returns(Promise.resolve(true))
            res = await processCommand(dispatchable)
          })

          it('returns an invite notification in the language that the command was sent in', () => {
            expect(res).to.eql({
              command: commands.INVITE,
              payload: [inviteePhoneNumbers[0]],
              status: statuses.SUCCESS,
              message: messagesIn(languages.EN).commandResponses.invite.success(1),
              notifications: [
                {
                  recipient: inviteePhoneNumbers[0],
                  message: messagesIn(languages.ES).notifications.inviteReceived,
                },
              ],
            })
          })
        })
      })

      describe('when sender is a subscriber (and there are no errors)', () => {
        const dispatchable = { sdMessage, channel: vouchingOnChannel, sender: subscriber }
        let res
        beforeEach(async () => {
          issueInviteStub.returns(Promise.resolve(true))
          countInvitesStub.returns(Promise.resolve(1))
          res = await processCommand(dispatchable)
        })

        it('creates an invite record', () => {
          expect(issueInviteStub.callCount).to.eql(2)
        })

        it('returns SUCCESS with notification for invitee', () => {
          expect(res).to.eql({
            command: commands.INVITE,
            payload: inviteePhoneNumbers,
            status: statuses.SUCCESS,
            message: commandResponsesFor(subscriber).invite.success(2),
            notifications: [
              {
                recipient: inviteePhoneNumbers[0],
                message: messagesIn(language).notifications.inviteReceived,
              },
              {
                recipient: inviteePhoneNumbers[1],
                message: messagesIn(language).notifications.inviteReceived,
              },
            ],
          })
        })
      })
    })

    // VOUCHING_ADMIN
    describe('when vouch mode is ADMIN', () => {
      const vouchingAdminChannel = {
        ...channel,
        vouchMode: vouchModes.ADMIN,
        vouchLevel: 1,
      }

      describe('when sender is an admin', () => {
        const dispatchable = { sdMessage, channel: vouchingAdminChannel, sender: admin }
        let res
        beforeEach(async () => {
          issueInviteStub.returns(Promise.resolve(true))
          countInvitesStub.returns(Promise.resolve(0))
          res = await processCommand(dispatchable)
        })

        it('creates the invites', () => {
          expect(issueInviteStub.callCount).to.eql(2)
        })

        it('returns SUCCESS with notification for invitee', () => {
          expect(res).to.eql({
            command: commands.INVITE,
            payload: inviteePhoneNumbers,
            status: statuses.SUCCESS,
            message: commandResponsesFor(admin).invite.success(2),
            notifications: [
              {
                recipient: inviteePhoneNumbers[0],
                message: messagesIn(language).notifications.inviteReceived,
              },
              {
                recipient: inviteePhoneNumbers[1],
                message: messagesIn(language).notifications.inviteReceived,
              },
            ],
          })
        })
      })

      describe('when sender is a subscriber or non-member of the channel', () => {
        beforeEach(async () => {
          issueInviteStub.returns(Promise.resolve(true))
          countInvitesStub.returns(Promise.resolve(0))
        })

        const senders = [(subscriber, randomPerson)]

        senders.forEach(sender => {
          const dispatchable = { sdMessage, channel: vouchingAdminChannel, sender }
          it('does not create an invite record', () => {
            expect(issueInviteStub.callCount).to.eql(0)
          })

          it('returns UNAUTHORIZED', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.INVITE,
              payload: inviteePhoneNumbers,
              status: statuses.UNAUTHORIZED,
              message: commandResponsesFor(sender).invite.notSubscriber,
              notifications: [],
            })
          })
        })
      })
    })

    // VOUCH_LEVEL
    describe('when vouch mode is ON and set to greater than 1', () => {
      describe('sender is an admin and invitees are not yet subscribers or invited', () => {
        const extraVouchedChannel = { ...channel, vouchMode: vouchModes.ON, vouchLevel: 2 }
        const dispatchable = { sdMessage, channel: extraVouchedChannel, sender: admin }
        let res
        beforeEach(async () => {
          issueInviteStub.returns(Promise.resolve(true))
          countInvitesStub.returns(Promise.resolve(1))
          res = await processCommand(dispatchable)
        })

        it('returns success and sends vouch-level-aware notifications', () => {
          expect(res).to.eql({
            command: commands.INVITE,
            payload: inviteePhoneNumbers,
            status: statuses.SUCCESS,
            message: commandResponsesFor(admin).invite.success(2),
            notifications: [
              {
                recipient: inviteePhoneNumbers[0],
                message: messagesIn(language).notifications.vouchedInviteReceived(1, 2),
              },
              {
                recipient: inviteePhoneNumbers[1],
                message: messagesIn(language).notifications.vouchedInviteReceived(1, 2),
              },
            ],
          })
        })
      })
    })

    // VOUCHING_OFF
    describe('when vouch mode is OFF', () => {
      const dispatchable = { channel, sender: admin, sdMessage }

      it('has same behavior as vouch mode ON', async () => {
        issueInviteStub.returns(Promise.resolve(true))
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INVITE,
          payload: inviteePhoneNumbers,
          status: statuses.SUCCESS,
          message: commandResponsesFor(admin).invite.success(2),
          notifications: [
            {
              recipient: inviteePhoneNumbers[0],
              message: messagesIn(language).notifications.inviteReceived,
            },
            {
              recipient: inviteePhoneNumbers[1],
              message: messagesIn(language).notifications.inviteReceived,
            },
          ],
        })
      })
    })
  })

  describe('JOIN command', () => {
    const sdMessage = sdMessageOf({ sender: channel, message: localizedCmds.JOIN })
    let addSubscriberStub

    beforeEach(() => (addSubscriberStub = sinon.stub(membershipRepository, 'addSubscriber')))

    describe('when channel has reached its subscriber limit', () => {
      const subscriberLimit = getSubscriberMemberships(channel).length
      const dispatchable = {
        channel: { ...channel, subscriberLimit },
        sender: randomPerson,
        sdMessage,
      }

      it('responds with an ERROR', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.JOIN,
          payload: '',
          status: statuses.ERROR,
          message: commandResponsesFor(randomPerson).join.subscriberLimitReached(subscriberLimit),
          notifications: [],
        })
      })
    })

    describe('when vouch mode is on', () => {
      const vouchedChannel = { ...channel, vouchMode: vouchModes.ON }
      const dispatchable = { channel: vouchedChannel, sender: randomPerson, sdMessage }

      it('responds with an ERROR', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.JOIN,
          payload: '',
          status: statuses.ERROR,
          message: commandResponsesInCommandLang.join.inviteRequired,
          notifications: [],
        })
      })
    })

    describe('when vouch mode is off', () => {
      describe('when number is not subscribed to channel', () => {
        const dispatchable = { channel, sender: randomPerson, sdMessage }

        describe('in all cases', () => {
          beforeEach(() => addSubscriberStub.returns(Promise.resolve()))

          it('attempts to subscribe sender to channel in the language they used to signup', async () => {
            await processCommand(dispatchable)
            expect(addSubscriberStub.getCall(0).args).to.eql([
              channel.phoneNumber,
              randomPerson.memberPhoneNumber,
              language,
            ])
          })
        })

        describe('when adding subscriber succeeds', () => {
          beforeEach(() => addSubscriberStub.returns(Promise.resolve(subscriptionFactory())))

          it('returns SUCCESS status/message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.JOIN,
              payload: '',
              status: statuses.SUCCESS,
              message: commandResponsesInCommandLang.join.success,
              notifications: [],
            })
          })

          it('logs membership creation (if applicable)', async () => {
            await processCommand(dispatchable)
            expect(logIfFirstMembershipStub.callCount).to.eql(1)
            expect(logIfFirstMembershipStub.getCall(0).args).to.eql([
              randomPerson.memberPhoneNumber,
            ])
          })
        })

        describe('when adding subscriber fails', () => {
          beforeEach(() => addSubscriberStub.callsFake(() => Promise.reject('foo')))

          it('returns ERROR status/message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.JOIN,
              payload: '',
              status: statuses.ERROR,
              message: commandResponsesInCommandLang.join.error,
              notifications: [],
            })
          })
        })
      })

      describe('when number is subscribed to channel', () => {
        const dispatchable = { channel, sender: subscriber, sdMessage }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not try to add subscriber', () => {
          expect(addSubscriberStub.callCount).to.eql(0)
        })

        it('returns "already member" status/message', () => {
          expect(result).to.eql({
            command: commands.JOIN,
            payload: '',
            status: statuses.ERROR,
            message: commandResponsesInCommandLang.join.alreadyMember,
            notifications: [],
          })
        })
      })

      describe('when number belongs to a channel admin', () => {
        const dispatchable = { channel, sender: admin, sdMessage }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not try to add subscriber', () => {
          expect(addSubscriberStub.callCount).to.eql(0)
        })

        it('returns "already member" status/message', () => {
          expect(result).to.eql({
            command: commands.JOIN,
            payload: '',
            status: statuses.ERROR,
            message: commandResponsesInCommandLang.join.alreadyMember,
            notifications: [],
          })
        })
      })
    })
  })

  describe('LEAVE command', () => {
    const sdMessage = sdMessageOf({ sender: channel, message: 'LEAVE' })
    let removeMemberStub
    beforeEach(() => (removeMemberStub = sinon.stub(membershipRepository, 'removeMember')))

    describe('when sender is subscribed to channel', () => {
      const dispatchable = { channel, sender: subscriber, sdMessage }
      beforeEach(() => removeMemberStub.returns(Promise.resolve()))

      it('attempts to remove subscriber', async () => {
        await processCommand(dispatchable)
        expect(removeMemberStub.getCall(0).args).to.eql([
          channel.phoneNumber,
          subscriber.phoneNumber,
        ])
      })

      describe('when removing subscriber succeeds', () => {
        beforeEach(() => removeMemberStub.returns(Promise.resolve(1)))

        it('returns SUCCESS status/message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.LEAVE,
            payload: '',
            status: statuses.SUCCESS,
            message: commandResponsesFor(subscriber).leave.success,
            notifications: [],
          })
        })

        it('logs membership destruction (if applicable)', async () => {
          await processCommand(dispatchable)
          expect(logIfLastMembershipStub.callCount).to.eql(1)
          expect(logIfLastMembershipStub.getCall(0).args).to.eql([subscriber.phoneNumber])
        })
      })

      describe('when removing subscriber fails', () => {
        beforeEach(() => removeMemberStub.callsFake(() => Promise.reject('boom!')))

        it('returns ERROR status/message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.LEAVE,
            payload: '',
            status: statuses.ERROR,
            message: commandResponsesFor(subscriber).leave.error,
            notifications: [],
          })
        })
      })
    })

    describe('when sender is not subscribed to channel', () => {
      const dispatchable = { channel, sender: randomPerson, sdMessage }
      let result
      beforeEach(async () => (result = await processCommand(dispatchable)))

      it('does not try to remove subscriber', () => {
        expect(removeMemberStub.callCount).to.eql(0)
      })

      it('returns UNAUTHORIZED status/message', () => {
        expect(result).to.eql({
          command: commands.LEAVE,
          payload: '',
          status: statuses.UNAUTHORIZED,
          message: commandResponsesFor(randomPerson).leave.notSubscriber,
          notifications: [],
        })
      })
    })

    describe('when sender is an admin', () => {
      const sender = admin
      let result
      const dispatchable = { channel, sender, sdMessage }

      beforeEach(async () => {
        removeMemberStub.returns(Promise.resolve([1, 1]))
        result = await processCommand(dispatchable)
      })

      it('removes sender as admin of channel', async () => {
        expect(removeMemberStub.getCall(0).args).to.eql([
          channel.phoneNumber,
          sender.memberPhoneNumber,
        ])
      })

      it('returns SUCCESS status, message, and notifications', () => {
        expect(result).to.eql({
          command: commands.LEAVE,
          payload: '',
          status: statuses.SUCCESS,
          message: commandResponsesFor(admin).leave.success,
          notifications: bystanderAdminMemberships.map(membership => ({
            recipient: membership.memberPhoneNumber,
            message: `[${prefixesFor(membership).notificationHeader}]\n${messagesIn(
              membership.language,
            ).notifications.adminLeft(sender.adminId)}`,
          })),
        })
      })
    })
  })

  describe('PRIVATE command', () => {
    const messageBody = 'hello this is private!'
    const sdMessage = sdMessageOf({
      sender: channel.phoneNumber,
      message: `${localizedCmds.PRIVATE} ${messageBody}`,
      attachments,
    })

    describe('when sender is an admin', () => {
      const sender = admin
      const dispatchable = { channel, sender, sdMessage }
      const adminMemberships = channel.memberships.slice(0, 3)

      it('returns a success status and notifications for each admin', async () => {
        const result = await processCommand(dispatchable)
        expect(result).to.eql({
          command: commands.PRIVATE,
          payload: 'hello this is private!',
          status: statuses.SUCCESS,
          notifications: [
            ...adminMemberships.map(membership => ({
              recipient: membership.memberPhoneNumber,
              message: `[${prefixesFor(membership).privateMessage} ${
                prefixesFor(membership).fromAdmin
              } ${sender.adminId}]\n${messageBody}`,
              attachments,
            })),
          ],
        })
      })
    })
  })

  describe('REMOVE command', () => {
    const removalTarget = channel.memberships[1]
    const removalTargetNumber = removalTarget.memberPhoneNumber
    let validateStub, removeMemberStub, resolveMemberTypeStub

    beforeEach(() => {
      validateStub = sinon.stub(validator, 'validatePhoneNumber')
      sinon.stub(membershipRepository, 'isAdmin')
      removeMemberStub = sinon.stub(membershipRepository, 'removeMember')
      resolveMemberTypeStub = sinon.stub(membershipRepository, 'resolveMemberType')
    })

    describe('when sender is an admin', () => {
      const sender = admin
      beforeEach(() => removeMemberStub.returns(Promise.resolve()))

      describe('when payload is a valid phone number', () => {
        const sdMessage = sdMessageOf({
          sender: channel.phoneNumber,
          message: `${localizedCmds.REMOVE} ${removalTargetNumber}`,
        })
        const dispatchable = { channel, sender, sdMessage }
        beforeEach(() => validateStub.returns(true))

        describe('when removal target is an admin', () => {
          beforeEach(() => resolveMemberTypeStub.returns(Promise.resolve(memberTypes.ADMIN)))

          it("attempts to remove the admin from the channel's admins", async () => {
            await processCommand(dispatchable)
            expect(removeMemberStub.getCall(0).args).to.eql([
              channel.phoneNumber,
              removalTargetNumber,
            ])
          })

          describe('when removing the admin succeeds', () => {
            beforeEach(() => removeMemberStub.returns(Promise.resolve([1, 1])))

            it('returns a SUCCESS status and message', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.REMOVE,
                payload: removalTargetNumber,
                status: statuses.SUCCESS,
                message: commandResponsesFor(admin).remove.success(removalTargetNumber),
                notifications: [
                  // removed admin
                  {
                    recipient: removalTargetNumber,
                    message: `[${
                      prefixesFor(removalTarget).notificationHeader
                    }]\n${notificationsFor(removalTarget).toRemovedAdmin(sender.adminId)}`,
                  },
                  // bystander admins
                  {
                    recipient: channel.memberships[2].memberPhoneNumber,
                    message: `[${
                      prefixesFor(channel.memberships[2]).notificationHeader
                    }]\n${notificationsFor(channel.memberships[2]).adminRemoved(
                      sender.adminId,
                      removalTarget.adminId,
                    )}`,
                  },
                ],
              })
            })

            it('logs membership destruction (if applicable)', async () => {
              await processCommand(dispatchable)
              expect(logIfLastMembershipStub.callCount).to.eql(1)
              expect(logIfLastMembershipStub.getCall(0).args).to.eql([removalTargetNumber])
            })
          })

          describe('when removing the admin fails', () => {
            beforeEach(() => removeMemberStub.callsFake(() => Promise.reject('oh noes!')))

            it('returns an ERROR status/message', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.REMOVE,
                payload: removalTargetNumber,
                status: statuses.ERROR,
                message: commandResponsesFor(admin).remove.dbError(removalTargetNumber),
                notifications: [],
              })
            })
          })
        })

        describe('when removal target is a subscriber', () => {
          beforeEach(() => resolveMemberTypeStub.returns(Promise.resolve(memberTypes.SUBSCRIBER)))

          it('attempts to remove them', async () => {
            await processCommand(dispatchable)
            expect(removeMemberStub.getCall(0).args).to.eql([
              channel.phoneNumber,
              removalTargetNumber,
            ])
          })

          describe('when removing subscriber succeeds', () => {
            beforeEach(() => removeMemberStub.returns(Promise.resolve([1, 1])))

            it('returns a SUCCESS status / message', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.REMOVE,
                payload: removalTargetNumber,
                status: statuses.SUCCESS,
                message: commandResponsesFor(admin).remove.success(removalTargetNumber),
                notifications: [
                  // removed
                  {
                    recipient: removalTargetNumber,
                    message: notificationsFor(removalTarget).toRemovedSubscriber,
                  },
                  // bystanders
                  {
                    recipient: channel.memberships[2].memberPhoneNumber,
                    message: `[${
                      prefixesFor(channel.memberships[2]).notificationHeader
                    }]\n${notificationsFor(channel.memberships[2]).subscriberRemoved(
                      sender.adminId,
                      removalTarget.adminId,
                    )}`,
                  },
                ],
              })
            })

            it('logs membership destruction (if applicable)', async () => {
              await processCommand(dispatchable)
              expect(logIfLastMembershipStub.callCount).to.eql(1)
              expect(logIfLastMembershipStub.getCall(0).args).to.eql([removalTargetNumber])
            })
          })
        })

        describe('when removal target is a rando', () => {
          beforeEach(() => resolveMemberTypeStub.returns(Promise.resolve(memberTypes.NONE)))

          it('does not attempt to remove anyone', async () => {
            await processCommand(dispatchable)
            expect(removeMemberStub.callCount).to.eql(0)
          })

          it('returns an ERROR status / message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.REMOVE,
              payload: removalTargetNumber,
              status: statuses.ERROR,
              message: commandResponsesFor(admin).remove.targetNotMember(removalTargetNumber),
              notifications: [],
            })
          })
        })
      })

      describe('when payload is not a valid phone number', async () => {
        const sdMessage = sdMessageOf({ sender: channel, message: `${localizedCmds.REMOVE} foo` })
        const dispatchable = { channel, sender, sdMessage }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not attempt to remove admin', () => {
          expect(removeMemberStub.callCount).to.eql(0)
        })

        it('returns a SUCCESS status / message', () => {
          expect(result).to.eql({
            command: commands.REMOVE,
            payload: '',
            status: statuses.ERROR,
            message: parseErrorsInCommandLang.invalidPhoneNumber('foo'),
            notifications: [],
          })
        })
      })
    })

    describe('when sender is not an admin', () => {
      const sdMessage = sdMessageOf({ sender: channel, message: `REMOVE ${removalTargetNumber}` })
      const dispatchable = { channel, sender: randomPerson, sdMessage }
      beforeEach(async () => await processCommand(dispatchable))

      it('does not attempt to add admin', () => {
        expect(removeMemberStub.callCount).to.eql(0)
      })
    })
  })

  // REQUEST
  describe('REQUEST command', () => {
    describe('when sent on the support channel', () => {
      const supportChannel = { ...channel, phoneNumber: supportPhoneNumber }
      const dispatchable = {
        channel: supportChannel,
        sender: randomPerson,
        sdMessage: sdMessageOf({
          sender: supportChannel,
          message: `${localizedCmds.REQUEST}`,
        }),
      }
      it("returns a success status and message containing the new channel's phone number", async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.REQUEST,
          payload: '',
          status: statuses.SUCCESS,
          message: commandResponsesFor(randomPerson).request.success,
          notifications: [],
        })
      })
    })

    describe('when not sent on the support channel', () => {
      const message = `${localizedCmds.REQUEST}`
      const sdMessage = sdMessageOf({ sender: channel, message })

      describe('when sender is an admin', () => {
        const dispatchable = { channel, sender: admin, sdMessage }

        it('returns an ERROR status and unnecessary payload message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.REQUEST,
            payload: '',
            status: statuses.ERROR,
            message: commandResponsesFor(admin).none.error,
            notifications: [],
          })
        })
      })

      describe('when sender is a subscriber', () => {
        const dispatchable = { channel, sender: subscriber, sdMessage }

        it('returns a success status and hotline notifications', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.NONE,
            payload: '',
            status: statuses.SUCCESS,
            message: notificationsFor(subscriber).hotlineMessageSent,
            notifications: [
              {
                recipient: adminMemberships[0].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[0].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
              {
                recipient: adminMemberships[1].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[1].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
              {
                recipient: adminMemberships[2].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[2].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
            ],
          })
        })
      })

      describe('when sender is a random person', () => {
        const dispatchable = { channel, sender: randomPerson, sdMessage }

        it('sends a subscriber help message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.NONE,
            payload: '',
            status: statuses.SUCCESS,
            message: notificationsFor(randomPerson).hotlineMessageSent,
            notifications: [
              {
                recipient: adminMemberships[0].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[0].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
              {
                recipient: adminMemberships[1].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[1].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
              {
                recipient: adminMemberships[2].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[2].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${message}`,
                attachments: [],
              },
            ],
          })
        })
      })
    })
  })

  // REPLY
  describe('REPLY command', () => {
    const sender = admin
    const messageId = 1312
    const hotlineReply = { messageId, reply: 'foo' }
    const dispatchable = {
      channel,
      sender,
      sdMessage: sdMessageOf({
        sender: channel.phoneNumber,
        message: `${localizedCmds.REPLY} @${messageId} foo`,
        attachments,
      }),
    }

    let findMemberPhoneNumberStub, findMembershipStub
    beforeEach(() => {
      findMemberPhoneNumberStub = sinon.stub(hotlineMessageRepository, 'findMemberPhoneNumber')
      findMembershipStub = sinon.stub(membershipRepository, 'findMembership')
    })

    describe('when sender is an admin', () => {
      describe('when admin specifies a valid hotline id for message sent by subscriber', () => {
        beforeEach(() => {
          findMemberPhoneNumberStub.returns(Promise.resolve(subscriber.phoneNumber))
          findMembershipStub.onCall(0).returns(Promise.resolve(subscriber))
          findMembershipStub.onCall(1).returns(Promise.resolve(admin))
        })

        it('returns SUCCESS w/ localized notifications for admins and hotline sender', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.REPLY,
            status: statuses.SUCCESS,
            message: commandResponsesFor(admin).hotlineReply.success(hotlineReply),
            notifications: [
              // response to the incoming hotline message sender
              {
                recipient: subscriber.phoneNumber,
                message: messagesIn(subscriber.language).notifications.hotlineReplyOf(
                  hotlineReply,
                  memberTypes.SUBSCRIBER,
                ),
                attachments,
              },
              // notifications for the admins
              ...adminMemberships.map(membership => ({
                recipient: membership.memberPhoneNumber,
                message: `[${prefixesFor(membership).hotlineReplyTo(messageId)} ${
                  prefixesFor(membership).fromAdmin
                } ${sender.adminId}]\nfoo`,
                attachments,
              })),
            ],
            payload: { messageId: 1312, reply: 'foo' },
          })
        })
      })

      describe('when admin specifies valid hotline id for message from a non-subscriber', () => {
        beforeEach(() => {
          findMemberPhoneNumberStub.returns(Promise.resolve(randomPerson.memberPhoneNumber))
          findMembershipStub.onCall(0).returns(Promise.resolve(null))
          findMembershipStub.onCall(1).returns(Promise.resolve(admin))
        })

        it('returns SUCCESS w/ localized notifications for admins and non-localized notification for hotline sender', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.REPLY,
            status: statuses.SUCCESS,
            message: `[${prefixesFor(admin).hotlineReplyTo(messageId)}]\nfoo`,
            notifications: [
              {
                recipient: randomPerson.memberPhoneNumber,
                message: messagesIn(defaultLanguage).notifications.hotlineReplyOf(
                  hotlineReply,
                  memberTypes.NONE,
                ),
                attachments,
              },
              ...adminMemberships.map(membership => {
                return {
                  recipient: membership.memberPhoneNumber,
                  message: `[${prefixesFor(membership).hotlineReplyTo(messageId)} ${
                    prefixesFor(membership).fromAdmin
                  } ${sender.adminId}]\nfoo`,
                  attachments,
                }
              }),
            ],
            payload: { messageId: 1312, reply: 'foo' },
          })
        })
      })

      describe('when admin specifies an id that does not exist', () => {
        beforeEach(() => findMemberPhoneNumberStub.callsFake(() => Promise.reject()))

        it('returns ERROR status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.REPLY,
            status: statuses.ERROR,
            message: commandResponsesFor(admin).hotlineReply.invalidMessageId(messageId),
            notifications: [],
            payload: { messageId: 1312, reply: 'foo' },
          })
        })
      })

      describe('when admin specifies an invalid id', () => {
        const _dispatchable = merge({}, dispatchable, {
          sdMessage: {
            messageBody: `${localizedCmds.REPLY} @ us if you can come tonight`,
          },
        })

        it('returns an ERROR', async () => {
          expect(await processCommand(_dispatchable)).to.eql({
            command: commands.REPLY,
            status: statuses.ERROR,
            message: parseErrorsInCommandLang.invalidHotlineMessageId(
              '@ us if you can come tonight',
            ),
            notifications: [],
            payload: '',
          })
        })
      })
    })
  })

  describe('RESTART command', () => {
    const dispatchable = {
      channel: { ...channel, phoneNumber: diagnosticsPhoneNumber },
      sender: admin,
      sdMessage: sdMessageOf({
        sender: channel.phoneNumber,
        message: `${localizedCmds.RESTART} ${maintainerPassphrase}`,
      }),
    }
    let isMaintainerStub, restartStub //, abortStub, isAliveStub, stopStub, runStub

    beforeEach(() => {
      isMaintainerStub = sinon.stub(channelRepository, 'isMaintainer')
      sinon.stub(channelRepository, 'getMaintainers').returns(Promise.resolve(adminMemberships))
      restartStub = sinon.stub(diagnostics, 'restartAll').returns(Promise.resolve('v0.0.1'))
    })

    describe('when sent by non-maintainer', () => {
      beforeEach(() => isMaintainerStub.returns(Promise.resolve(false)))

      it('returns UNAUTHORIZED', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RESTART,
          status: statuses.UNAUTHORIZED,
          message: notificationsFor(admin).restartRequesterNotAuthorized,
          notifications: [],
          payload: maintainerPassphrase,
        })
      })
    })

    describe('when sent by maintainer on wrong channel with correct passphrase', () => {
      beforeEach(() => isMaintainerStub.returns(Promise.resolve(true)))
      const _dispatchable = merge({}, dispatchable, {
        channel,
        sdMessage: { messageBody: `${localizedCmds.RESTART} ${maintainerPassphrase}` },
      })

      it('returns UNAUTHORIZED', async () => {
        expect(await processCommand(_dispatchable)).to.eql({
          command: commands.RESTART,
          status: statuses.UNAUTHORIZED,
          message: notificationsFor(admin).restartChannelNotAuthorized,
          notifications: [],
          payload: maintainerPassphrase,
        })
      })
    })

    describe('when sent by maintainer on diagnostics channel with wrong passphrase', () => {
      beforeEach(() => isMaintainerStub.returns(Promise.resolve(true)))
      const _dispatchable = merge({}, dispatchable, {
        sdMessage: { messageBody: `${localizedCmds.RESTART} foobar` },
      })

      it('returns UNAUTHORIZED', async () => {
        expect(await processCommand(_dispatchable)).to.eql({
          command: commands.RESTART,
          status: statuses.UNAUTHORIZED,
          message: notificationsFor(admin).restartPassNotAuthorized,
          notifications: [],
          payload: 'foobar',
        })
      })
    })

    describe('when sent by maintainer on diagnostics channel with correct passphrase', () => {
      beforeEach(() => isMaintainerStub.returns(Promise.resolve(true)))

      describe('in all cases', () => {
        it('tries to restart signald and signalboost', async () => {
          await processCommand(dispatchable)
          expect(restartStub.callCount).to.eql(1)
        })
      })

      describe('when restart succeeds', () => {
        it('returns SUCCESS', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.RESTART,
            status: statuses.SUCCESS,
            message: messagesIn(admin.language).notifications.restartSuccessResponse,
            notifications: [
              {
                message: `[${
                  prefixesFor(adminMemberships[1]).notificationHeader
                }]\n${notificationsFor(adminMemberships[1]).restartSuccessNotification(
                  admin.adminId,
                )}`,
                recipient: adminMemberships[1].memberPhoneNumber,
              },
              {
                message: `[${
                  prefixesFor(adminMemberships[2]).notificationHeader
                }]\n${notificationsFor(adminMemberships[2]).restartSuccessNotification(
                  admin.adminId,
                )}`,
                recipient: adminMemberships[2].memberPhoneNumber,
              },
            ],
            payload: maintainerPassphrase,
          })
        })
      })

      describe('when restart fails', () => {
        beforeEach(() => {
          isMaintainerStub.returns(Promise.resolve(true))
          restartStub.callsFake(() => Promise.reject('isAlive failed!'))
        })

        it('returns ERROR', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.RESTART,
            status: statuses.ERROR,
            message: notificationsFor(admin).restartFailure('isAlive failed!'),
            notifications: [],
            payload: maintainerPassphrase,
          })
        })
      })
    })
  })

  describe('SET_LANGUAGE commands', () => {
    const dispatchable = {
      channel,
      sender: subscriber,
      sdMessage: sdMessageOf({ sender: channel, message: 'francais' }),
    }

    let updateLanguageStub
    beforeEach(() => (updateLanguageStub = sinon.stub(membershipRepository, 'updateLanguage')))

    describe('when update call succeeds', () => {
      beforeEach(() => {
        updateLanguageStub.returns(Promise.resolve({ ...subscriber, language: languages.FR }))
      })

      it('returns a SUCCESS status in new language', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.SET_LANGUAGE,
          payload: '',
          status: statuses.SUCCESS,
          message: messagesIn(languages.FR).commandResponses.setLanguage.success,
          notifications: [],
        })
      })
    })

    describe('when update call fails', () => {
      beforeEach(() => {
        updateLanguageStub.callsFake(() => Promise.reject(new Error('oh noes!')))
      })

      it('returns an error status in new language', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.SET_LANGUAGE,
          payload: '',
          status: statuses.ERROR,
          message: messagesIn(languages.FR).commandResponses.setLanguage.dbError,
          notifications: [],
        })
      })
    })
  })

  // TOGGLE
  describe('TOGGLE commands', () => {
    let updateChannelStub
    beforeEach(() => (updateChannelStub = sinon.stub(channelRepository, 'update')))

    const scenarios = [
      {
        ...toggles.HOTLINE,
        isOn: true,
        command: commands.HOTLINE_ON,
        commandStr: localizedCmds.HOTLINE_ON,
      },
      {
        ...toggles.HOTLINE,
        isOn: false,
        command: commands.HOTLINE_OFF,
        commandStr: localizedCmds.HOTLINE_OFF,
      },
    ]

    scenarios.forEach(({ name, notificationKey, dbField, isOn, command, commandStr }) => {
      describe('when sender is an admin', () => {
        const sender = admin

        const sdMessage = sdMessageOf({ sender: channel.phoneNumber, message: commandStr })
        const dispatchable = { channel, sender, sdMessage }

        it('attempts to update the toggle field on the channel db record', async () => {
          updateChannelStub.returns(Promise.resolve())
          await processCommand(dispatchable)
          expect(updateChannelStub.getCall(0).args).to.have.deep.members([
            channel.phoneNumber,
            { [dbField]: isOn },
          ])
        })

        describe('when db update succeeds', async () => {
          beforeEach(() => updateChannelStub.returns(Promise.resolve()))

          it('returns a SUCCESS status, message, and notifications', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command,
              status: statuses.SUCCESS,
              payload: '',
              message: commandResponsesFor(sender).toggles[name].success(isOn),
              notifications: [
                ...bystanderAdminMemberships.map(membership => ({
                  recipient: membership.memberPhoneNumber,
                  message: `[${prefixesFor(membership).notificationHeader}]\n${notificationsFor(
                    membership,
                  )[notificationKey](isOn, sender.adminId)}`,
                })),
              ],
            })
          })
        })

        describe('when db update fails', () => {
          beforeEach(() => updateChannelStub.callsFake(() => Promise.reject(new Error('db error'))))

          it('returns an ERROR status', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command,
              payload: '',
              status: statuses.ERROR,
              message: commandResponsesFor(sender).toggles[name].dbError(isOn),
              notifications: [],
            })
          })
        })
      })
    })

    describe('when toggle is followed by a payload', () => {
      scenarios.forEach(({ commandStr, command }) => {
        const dispatchable = {
          channel,
          sender: admin,
          sdMessage: sdMessageOf({ sender: channel, message: `${commandStr} foo` }),
        }
        it('returns an error and message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command,
            payload: '',
            status: statuses.ERROR,
            message: parseErrorsInCommandLang.unnecessaryPayload(commandStr),
            notifications: [],
          })
        })
      })
    })
  })

  describe('VOUCHING ON/OFF/ADMIN commands', () => {
    let updateChannelStub
    beforeEach(() => (updateChannelStub = sinon.stub(channelRepository, 'update')))
    afterEach(() => updateChannelStub.restore())

    const vouchingScenarios = [
      {
        command: commands.VOUCHING_ON,
        commandStr: localizedCmds.VOUCHING_ON,
        mode: 'ON',
      },
      {
        command: commands.VOUCHING_OFF,
        commandStr: localizedCmds.VOUCHING_OFF,
        mode: 'OFF',
      },
      {
        command: commands.VOUCHING_ADMIN,
        commandStr: localizedCmds.VOUCHING_ADMIN,
        mode: 'ADMIN',
      },
    ]

    vouchingScenarios.forEach(({ command, commandStr, mode }) => {
      const sdMessage = sdMessageOf({ sender: channel.phoneNumber, message: commandStr })

      describe('when sender is an admin', () => {
        const sender = admin
        const dispatchable = { channel, sender, sdMessage }

        it('attempts to update the vouching field on the channel db record', async () => {
          updateChannelStub.returns(Promise.resolve())
          await processCommand(dispatchable)
          expect(updateChannelStub.getCall(0).args).to.have.deep.members([
            channel.phoneNumber,
            { ['vouchMode']: vouchModes[mode] },
          ])
        })

        describe('when db update succeeds', () => {
          beforeEach(() => updateChannelStub.returns(Promise.resolve()))

          it('returns a SUCCESS status, message, and notifications', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command,
              status: statuses.SUCCESS,
              payload: '',
              message: commandResponsesFor(sender).vouchMode.success(vouchModes[mode]),
              notifications: [
                ...bystanderAdminMemberships.map(membership => ({
                  recipient: membership.memberPhoneNumber,
                  message: `[${prefixesFor(membership).notificationHeader}]\n${notificationsFor(
                    membership,
                  ).vouchModeChanged(vouchModes[mode], sender.adminId)}`,
                })),
              ],
            })
          })
        })

        describe('when db update fails', () => {
          beforeEach(() => updateChannelStub.callsFake(() => Promise.reject(new Error('db error'))))

          it('returns an ERROR status', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command,
              payload: '',
              status: statuses.ERROR,
              message: commandResponsesFor(sender).vouchMode.dbError,
              notifications: [],
            })
          })
        })
      })
    })

    describe('when VOUCHING command is followed by a payload', () => {
      vouchingScenarios.forEach(({ commandStr, command }) => {
        const dispatchable = {
          channel,
          sender: admin,
          sdMessage: sdMessageOf({ sender: channel, message: `${commandStr} foo` }),
        }
        it('returns an error and message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command,
            payload: '',
            status: statuses.ERROR,
            message: parseErrorsInCommandLang.unnecessaryPayload(commandStr),
            notifications: [],
          })
        })
      })
    })
  })

  describe('VOUCH_LEVEL command', () => {
    const validVouchLevel = 4
    const invalidVouchLevel = 15

    let updateStub
    beforeEach(() => (updateStub = sinon.stub(channelRepository, 'update')))

    describe('when sender is an admin', () => {
      const sender = admin
      let result

      describe('when sender sets a valid vouch level', () => {
        const sdMessage = sdMessageOf({
          sender: channel.phoneNumber,
          message: `${localizedCmds.VOUCH_LEVEL} ${validVouchLevel}`,
        })
        const dispatchable = { channel, sender, sdMessage }

        describe('when updating the db succeeds', () => {
          beforeEach(async () => {
            updateStub.returns(Promise.resolve({ ...channel, vouchLevel: validVouchLevel }))
            result = await processCommand(dispatchable)
          })

          it('returns a SUCCESS status/message, and notifications', () => {
            expect(result).to.eql({
              command: commands.VOUCH_LEVEL,
              status: statuses.SUCCESS,
              message: messagesIn(sender.language).commandResponses.vouchLevel.success(
                validVouchLevel,
              ),
              payload: `${validVouchLevel}`,
              notifications: [
                ...bystanderAdminMemberships.map(membership => ({
                  recipient: membership.memberPhoneNumber,
                  message: `[${prefixesFor(membership).notificationHeader}]\n${notificationsFor(
                    membership,
                  ).vouchLevelChanged(sender.adminId, validVouchLevel)}`,
                })),
              ],
            })
          })
        })

        describe('when updating the db fails', () => {
          beforeEach(() => updateStub.callsFake(() => Promise.reject(new Error('flooooof'))))

          it('returns an ERROR status/message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.VOUCH_LEVEL,
              status: statuses.ERROR,
              message: commandResponsesFor(sender).vouchLevel.dbError,
              payload: `${validVouchLevel}`,
              notifications: [],
            })
          })
        })
      })

      describe('when sender sets an invalid vouch level', () => {
        const sdMessage = sdMessageOf({
          sender: channel,
          message: `${localizedCmds.VOUCH_LEVEL} ${invalidVouchLevel}`,
        })
        const dispatchable = { channel, sender, sdMessage }

        beforeEach(async () => {
          updateStub.returns(Promise.resolve({ ...channel, vouchLevel: invalidVouchLevel }))
          result = await processCommand(dispatchable)
        })

        it('returns an ERROR status/message', () => {
          expect(result).to.eql({
            command: commands.VOUCH_LEVEL,
            status: statuses.ERROR,
            message: parseErrorsInCommandLang.invalidVouchLevel(invalidVouchLevel),
            payload: '',
            notifications: [],
          })
        })
      })
    })
  })

  describe('ambiguous messages containing commands', () => {
    const subscriberNoPayloadCommands = [
      commands.ACCEPT,
      commands.DECLINE,
      commands.HELP,
      commands.INFO,
      commands.JOIN,
      commands.LEAVE,
      commands.SET_LANGUAGE,
    ]
    const adminNoPayloadCommands = [
      commands.DESTROY,
      commands.DESTROY_CONFIRM,
      commands.HOTLINE_ON,
      commands.HOTLINE_OFF,
      commands.VOUCHING_ON,
      commands.VOUCHING_OFF,
      commands.VOUCHING_ADMIN,
    ]
    const adminPayloadCommands = [
      commands.ADD,
      commands.BROADCAST,
      commands.REMOVE,
      commands.REPLY,
      commands.VOUCH_LEVEL,
    ]

    const expectHotlineMessages = (sender, _channel, _commands) =>
      Promise.all(
        _commands.map(async cmd => {
          const dispatchable = {
            channel: _channel,
            sender,
            sdMessage: sdMessageOf({
              sender: _channel,
              message: `${localizedCmds[cmd]} extra words`,
            }),
          }
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.NONE,
            status: statuses.SUCCESS,
            message: notificationsFor(sender).hotlineMessageSent,
            payload: '',
            notifications: [
              {
                recipient: adminMemberships[0].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[0].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${localizedCmds[cmd]} extra words`,
                attachments: [],
              },
              {
                recipient: adminMemberships[1].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[1].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${localizedCmds[cmd]} extra words`,
                attachments: [],
              },
              {
                recipient: adminMemberships[2].memberPhoneNumber,
                message: `[${messagesIn(adminMemberships[2].language).prefixes.hotlineMessage(
                  '42',
                )}]\n${localizedCmds[cmd]} extra words`,
                attachments: [],
              },
            ],
          })
        }),
      )

    const expectGenericErrors = (sender, _channel, commands) =>
      Promise.all(
        commands.map(async cmd => {
          const dispatchable = {
            channel: _channel,
            sender,
            sdMessage: sdMessageOf({
              sender: _channel,
              message: `${localizedCmds[cmd]} extra words`,
            }),
          }

          expect(await processCommand(dispatchable)).to.eql({
            command: 'NONE',
            message: notificationsFor(sender).hotlineMessagesDisabled(
              sender.type === memberTypes.SUBSCRIBER,
            ),
            notifications: [],
            payload: '',
            status: statuses.ERROR,
          })
        }),
      )

    describe('when sender is a subscriber or rando', () => {
      const sender = sample([subscriber, randomPerson])

      describe('when message is a no-payload command followed by a payload', () => {
        const noPayloadCommands = [...subscriberNoPayloadCommands, ...adminNoPayloadCommands]

        describe('when hotline messages are ON', () => {
          it('treats the message like a hotline message', async () => {
            await expectHotlineMessages(sender, channel, noPayloadCommands)
          })
        })

        describe('when hotline messages are OFF', () => {
          const _channel = { ...channel, hotlineOn: false }
          it('provides a generic error message', async () => {
            await expectGenericErrors(sender, _channel, noPayloadCommands)
          })
        })
      })

      describe('when message is command that a subscriber cannot issue (with or without payload)', () => {
        const adminOnlyCommands = [...adminNoPayloadCommands, ...adminPayloadCommands]

        describe('when hotline messages are ON', () => {
          it('treats the message like a hotline message', async () => {
            await expectHotlineMessages(sender, channel, adminOnlyCommands)
          })
        })
        describe('when hotline messages are OFF', () => {
          it('provides a generic error message', async () => {
            const _channel = { ...channel, hotlineOn: false }
            await expectGenericErrors(sender, _channel, adminOnlyCommands)
          })
        })
      })
    })

    describe('when sender is an admin', () => {
      describe('and message is a no-payload command followed by text', () => {
        it('prompts user to enter correct command, and asks if intent was to broadcast', async () => {
          await Promise.all(
            adminNoPayloadCommands.map(async command => {
              const dispatchable = {
                channel,
                sender: admin,
                sdMessage: sdMessageOf({
                  sender: channel,
                  message: `${localizedCmds[command]} extra words`,
                }),
              }

              expect(await processCommand(dispatchable)).to.eql({
                command,
                payload: '',
                message: parseErrorsInCommandLang.unnecessaryPayload(localizedCmds[command]),
                status: statuses.ERROR,
                notifications: [],
              })
            }),
          )
        })
      })
    })
  })

  describe('invalid command', () => {
    describe('when an admin sends a message not prefixed by a command ', () => {
      it('returns an error and message', async () => {
        const sender = admin
        const dispatchable = {
          channel,
          sender,
          sdMessage: sdMessageOf({ sender: channel, message: 'foo' }),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.NONE,
          payload: '',
          status: statuses.ERROR,
          message: messagesIn(sender.language).commandResponses.none.error,
          notifications: [],
        })
      })
    })

    describe('when a subscriber sends a message not prefixed by a command ', () => {
      describe('when the hotline is enabled', () => {
        it('returns a success status, command response, and notifications', async () => {
          const sender = subscriber
          const dispatchable = {
            channel: { ...channel, hotlineOn: true },
            sender,
            sdMessage: sdMessageOf({ sender: channel, message: 'foo', attachments }),
          }

          const adminMemberships = channel.memberships.slice(0, 3)
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.NONE,
            payload: '',
            status: statuses.SUCCESS,
            message: notificationsFor(sender).hotlineMessageSent,
            notifications: [
              ...adminMemberships.map(membership => ({
                recipient: membership.memberPhoneNumber,
                message: `[${messagesIn(membership.language).prefixes.hotlineMessage('42')}]\nfoo`,
                attachments,
              })),
            ],
          })
        })
      })

      describe('when the hotline is disabled', () => {
        it('returns an error and message', async () => {
          const sender = subscriber
          const dispatchable = {
            channel: { ...channel, hotlineOn: false },
            sender,
            sdMessage: sdMessageOf({ sender: channel, message: 'foo' }),
          }
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.NONE,
            payload: '',
            status: statuses.ERROR,
            message: messagesIn(sender.language).notifications.hotlineMessagesDisabled(true),
            notifications: [],
          })
        })
      })
    })
  })
})
