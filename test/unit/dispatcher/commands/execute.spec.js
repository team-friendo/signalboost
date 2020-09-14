import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { sample, times } from 'lodash'
import { processCommand } from '../../../../app/dispatcher/commands'
import { commands, toggles, vouchModes } from '../../../../app/dispatcher/commands/constants'
import { statuses } from '../../../../app/util'
import { languages } from '../../../../app/language'
import { commandResponses as CR } from '../../../../app/dispatcher/strings/messages/EN'
import signal from '../../../../app/signal'
import channelRepository from '../../../../app/db/repositories/channel'
import inviteRepository from '../../../../app/db/repositories/invite'
import membershipRepository from '../../../../app/db/repositories/membership'
import deauthorizationRepository from '../../../../app/db/repositories/deauthorization'
import eventRepository from '../../../../app/db/repositories/event'
import hotlineMessageRepository from '../../../../app/db/repositories/hotlineMessage'
import phoneNumberService from '../../../../app/registrar/phoneNumber'
import validator from '../../../../app/db/validations'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { genPhoneNumber, parenthesize } from '../../../support/factories/phoneNumber'
import { memberTypes } from '../../../../app/db/repositories/membership'
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
import { defaultLanguage } from '../../../../app/language'
describe('executing commands', () => {
  const channel = {
    name: 'foobar',
    description: 'foobar channel description',
    phoneNumber: '+13333333333',
    hotlineOn: true,
    vouchMode: vouchModes.OFF,
    deauthorizations: [deauthorizationFactory()],
    memberships: [
      ...times(3, () => adminMembershipFactory({ channelPhoneNumber: '+13333333333' })),
      ...times(2, () => subscriberMembershipFactory({ channelPhoneNumber: '+13333333333' })),
    ],
    messageCount: { broadcastIn: 42 },
  }
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
    phoneNumber: genPhoneNumber(),
    type: memberTypes.NONE,
    language: languages.EN,
  }
  const newAdminPhoneNumber = genPhoneNumber()
  const newAdminMembership = adminMembershipFactory({
    channelPhoneNumber: channel.phoneNumber,
    memberPhoneNumber: newAdminPhoneNumber,
    language: 'FR',
  })
  const rawNewAdminPhoneNumber = parenthesize(newAdminPhoneNumber)
  const deauthorizedPhoneNumber = channel.deauthorizations[0].memberPhoneNumber

  let logIfFirstMembershipStub, logIfLastMembershipStub

  beforeEach(() => {
    logIfFirstMembershipStub = sinon
      .stub(eventRepository, 'logIfFirstMembership')
      .returns(Promise.resolve(sample([null, eventFactory(eventTypes.MEMBER_CREATED)])))
    logIfLastMembershipStub = sinon
      .stub(eventRepository, 'logIfLastMembership')
      .returns(Promise.resolve(sample([null, eventFactory(eventTypes.MEMBER_DESTROYED)])))
  })
  afterEach(() => sinon.restore())

  describe('ACCEPT command', () => {
    const dispatchable = {
      channel: { ...channel, vouchMode: 'ON', vouchLevel: 1 },
      sender: randomPerson,
      sdMessage: sdMessageOf(channel, 'ACCEPT'),
    }
    let isMemberStub, countInvitesStub, acceptStub
    beforeEach(() => {
      isMemberStub = sinon.stub(membershipRepository, 'isMember')
      countInvitesStub = sinon.stub(inviteRepository, 'count')
      acceptStub = sinon.stub(inviteRepository, 'accept')
    })

    describe('when sender is already member of channel', () => {
      beforeEach(() => isMemberStub.returns(Promise.resolve(true)))
      it('returns an ERROR status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.ACCEPT,
          payload: '',
          status: statuses.ERROR,
          message: CR.accept.alreadyMember,
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
              message: CR.accept.belowVouchLevel(channel, channel.vouchLevel, 0),
              notifications: [],
            })
          })
        })

        describe('when sender has sufficient invites', () => {
          describe('when accept db call succeeds', () => {
            beforeEach(() => acceptStub.returns(Promise.resolve([membershipFactory(), 1])))

            it('returns SUCCESS status', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.ACCEPT,
                payload: '',
                status: statuses.SUCCESS,
                message: CR.accept.success(channel),
                notifications: [],
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
                message: CR.accept.dbError,
                notifications: [],
              })
            })
          })
        })
      })

      describe('when vouch mode is OFF and user has no invites', () => {
        const _dispatchable = { ...dispatchable, channel }
        beforeEach(() => countInvitesStub.returns(Promise.resolve(0)))

        describe('when accept db call succeeds', () => {
          beforeEach(() => acceptStub.returns(Promise.resolve([membershipFactory(), 1])))

          it('logs membership creation (if applicable)', async () => {
            await processCommand(_dispatchable)
            expect(logIfFirstMembershipStub.callCount).to.eql(1)
            expect(logIfFirstMembershipStub.getCall(0).args).to.eql([randomPerson.phoneNumber])
          })

          it('returns SUCCESS status', async () => {
            expect(await processCommand(_dispatchable)).to.eql({
              command: commands.ACCEPT,
              payload: '',
              status: statuses.SUCCESS,
              message: CR.accept.success(channel),
              notifications: [],
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
              message: CR.accept.dbError,
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
          message: CR.accept.dbError,
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
          message: CR.accept.dbError,
          notifications: [],
        })
      })
    })

    describe('when followed by a payload', () => {
      it('returns an error and message', async () => {
        const _dispatchable = { ...dispatchable, sdMessage: sdMessageOf(channel, 'accept my life') }
        expect(await processCommand(_dispatchable)).to.eql({
          command: commands.ACCEPT,
          payload: '',
          status: statuses.ERROR,
          message: messagesIn(defaultLanguage).parseErrors.unnecessaryPayload('accept'),
          notifications: [],
        })
      })
    })
  })

  describe('ADD command', () => {
    let addAdminStub, trustStub, destroyDeauthStub
    beforeEach(() => {
      addAdminStub = sinon.stub(membershipRepository, 'addAdmin')
      trustStub = sinon.stub(signal, 'trust')
      destroyDeauthStub = sinon.stub(deauthorizationRepository, 'destroy')
    })

    describe('when sender is an admin', () => {
      const sender = admin

      describe('when payload is a valid phone number', () => {
        const sdMessage = sdMessageOf(channel, `ADD ${rawNewAdminPhoneNumber}`)
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
                message: CR.add.success(newAdminPhoneNumber),
                notifications: [
                  // welcome message to newly added admin
                  {
                    recipient: newAdminPhoneNumber,
                    message: messagesIn(languages.FR).notifications.welcome(
                      sender.phoneNumber,
                      channel.phoneNumber,
                      channel.name,
                    ),
                  },
                  // notifications for all bystander admins
                  {
                    recipient: channel.memberships[1].memberPhoneNumber,
                    message: messagesIn(channel.memberships[1].language).notifications.adminAdded,
                  },
                  {
                    recipient: channel.memberships[2].memberPhoneNumber,
                    message: messagesIn(channel.memberships[2].language).notifications.adminAdded,
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
                message: CR.add.dbError(newAdminPhoneNumber),
                notifications: [],
              })
            })
          })
        })

        describe('when new admin has been previously deauthorized', () => {
          const sdMessage = sdMessageOf(channel, `ADD ${deauthorizedPhoneNumber}`)
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
                      }),
                    ),
                  ),
                )
                // note: we only test the happy path as failure path of this branch is tested exhaustively above

                it('returns a SUCCESS status, message, and notifications', async () => {
                  const result = await processCommand(dispatchable)
                  expect(result.status).to.eql(statuses.SUCCESS)
                  expect(result.message).to.eql(CR.add.success(deauthorizedPhoneNumber))
                  expect(result.notifications.length).to.eql(3)
                })
              })
            })
          })
        })
      })

      describe('when payload is not a valid phone number', async () => {
        const dispatchable = { channel, sender, sdMessage: sdMessageOf(channel, 'ADD foo') }
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
            message: CR.add.invalidPhoneNumber('foo'),
            notifications: [],
          })
        })
      })
    })

    describe('when sender is not an admin', () => {
      const dispatchable = {
        channel,
        sender: subscriber,
        sdMessage: sdMessageOf(channel, `ADD ${newAdminPhoneNumber}`),
      }
      let result
      beforeEach(async () => (result = await processCommand(dispatchable)))

      it('does not attempt to add admin', () => {
        expect(addAdminStub.callCount).to.eql(0)
      })

      it('returns an UNAUTHORIZED status/message', () => {
        expect(result).to.eql({
          command: commands.ADD,
          payload: newAdminPhoneNumber,
          status: statuses.UNAUTHORIZED,
          message: CR.add.notAdmin,
          notifications: [],
        })
      })
    })
  })

  describe('BROADCAST command', () => {
    const attachments = [{ filename: 'some/path', width: 42, height: 42, voiceNote: false }]
    const sdMessage = { ...sdMessageOf(channel, 'BROADCAST hello friendos!'), attachments }

    describe('when sender is an admin', () => {
      const dispatchable = { channel, sender: admin, sdMessage }

      it('returns a SUCCESS status and notifications', async () => {
        const adminHeader = messagesIn(admin.language).prefixes.broadcastMessage
        const subscriberHeader = channel.name
        const adminMemberships = channel.memberships.slice(0, 3)
        const subscriberMemberships = channel.memberships.slice(3)

        expect(await processCommand(dispatchable)).to.eql({
          command: commands.BROADCAST,
          payload: 'hello friendos!',
          message: '',
          status: statuses.SUCCESS,
          notifications: [
            ...adminMemberships.map(membership => ({
              recipient: membership.memberPhoneNumber,
              message: `[${adminHeader}]\nhello friendos!`,
              attachments,
            })),
            ...subscriberMemberships.map(membership => ({
              recipient: membership.memberPhoneNumber,
              message: `[${subscriberHeader}]\nhello friendos!`,
              attachments,
            })),
          ],
        })
      })
    })

    describe('when sender is not an admin', () => {
      const dispatchable = { channel, sender: subscriber, sdMessage }

      it('returns an error and message', async () => {
        const response = await processCommand(dispatchable)

        expect(response).to.eql({
          command: commands.BROADCAST,
          payload: 'hello friendos!',
          status: statuses.UNAUTHORIZED,
          message: CR.broadcast.notAdmin,
          notifications: [],
        })
      })
    })
  })

  describe('DECLINE command', () => {
    const dispatchable = {
      channel,
      sender: randomPerson,
      sdMessage: sdMessageOf(channel, 'DECLINE'),
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
          message: CR.decline.success,
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
          message: CR.decline.dbError,
          notifications: [],
        })
      })
    })

    describe('when followed by a payload', () => {
      it('returns an error and message', async () => {
        const _dispatchable = { ...dispatchable, sdMessage: sdMessageOf(channel, 'decline this') }
        expect(await processCommand(_dispatchable)).to.eql({
          command: commands.DECLINE,
          payload: '',
          status: statuses.ERROR,
          message: messagesIn(defaultLanguage).parseErrors.unnecessaryPayload('decline'),
          notifications: [],
        })
      })
    })
  })

  describe('DESTROY command', () => {
    const _dispatchable = { channel, sdMessage: sdMessageOf(channel, 'DESTROY') }

    describe('when issuer is an admin', () => {
      const dispatchable = { ..._dispatchable, sender: admin }

      it('responds with a confirmation prompt', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.DESTROY,
          status: statuses.SUCCESS,
          message: CR.destroy.confirm,
          payload: '',
          notifications: [],
        })
      })
    })

    describe('when issuer is a subscriber or rando', () => {
      ;[subscriber, randomPerson].forEach(sender => {
        const dispatchable = { ..._dispatchable, sender }

        it('responds with UNAUTHORIZED', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.DESTROY,
            status: statuses.UNAUTHORIZED,
            message: CR.destroy.notAdmin,
            payload: '',
            notifications: [],
          })
        })
      })
    })
  })

  describe('DESTROY_CONFIRM command', () => {
    const _dispatchable = {
      channel,
      sdMessage: sdMessageOf(channel, 'CONFIRM DESTROY'),
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
            message: CR.destroy.success,
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
            message: CR.destroy.error,
            notifications: [],
          })
        })
      })
    })

    describe('when issuer is a subscriber or rando', () => {
      ;[subscriber, randomPerson].forEach(sender => {
        const dispatchable = { ..._dispatchable, sender }
        let callCount, res

        beforeEach(async () => {
          callCount = destroyStub.callCount
          res = await processCommand(dispatchable)
        })

        it('does not attempt to destroy the channel', () => {
          expect(destroyStub.callCount).to.eql(callCount)
        })

        it('returns an UNAUTHORIZED message', () => {
          expect(res).to.eql({
            command: commands.DESTROY_CONFIRM,
            status: statuses.UNAUTHORIZED,
            payload: '',
            message: CR.destroy.notAdmin,
            notifications: [],
          })
        })
      })
    })
  })

  describe('HELP command', () => {
    const sdMessage = sdMessageOf(channel, 'HELP')

    describe('when sender is an admin', () => {
      const dispatchable = { channel, sender: admin, sdMessage }

      it('sends a help message to sender', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.HELP,
          payload: '',
          status: statuses.SUCCESS,
          message: CR.help.admin,
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
          message: CR.help.subscriber,
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
          message: CR.help.subscriber,
          notifications: [],
        })
      })
    })

    describe('when followed by a payload', () => {
      it('returns an error and message', async () => {
        const dispatchable = {
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'help me find the march'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.HELP,
          payload: '',
          status: statuses.ERROR,
          message: messagesIn(defaultLanguage).parseErrors.unnecessaryPayload('help'),
          notifications: [],
        })
      })
    })
  })

  describe('INFO command', () => {
    const sdMessage = sdMessageOf(channel, 'INFO')

    describe('when sender is an admin', () => {
      const dispatchable = { channel, sender: admin, sdMessage }

      it('sends an info message with more information', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          payload: '',
          status: statuses.SUCCESS,
          message: CR.info[memberTypes.ADMIN](channel),
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
          message: CR.info[memberTypes.SUBSCRIBER](channel),
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
          message: CR.info[memberTypes.NONE](channel),
          notifications: [],
        })
      })
    })

    describe('when followed by a payload', () => {
      it('returns an error and message', async () => {
        const dispatchable = {
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'info wars did it'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          payload: '',
          status: statuses.ERROR,
          message: messagesIn(defaultLanguage).parseErrors.unnecessaryPayload('info'),
          notifications: [],
        })
      })
    })
  })

  // INVITE
  describe('INVITE command', () => {
    const inviteePhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
    const sdMessage = sdMessageOf(channel, `INVITE ${inviteePhoneNumbers.join(',')}`)

    let isMemberStub, issueInviteStub, countInvitesStub
    beforeEach(() => {
      isMemberStub = sinon.stub(membershipRepository, 'isMember')
      issueInviteStub = sinon.stub(inviteRepository, 'issue')
      countInvitesStub = sinon.stub(inviteRepository, 'count')
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
            message: CR.invite.notSubscriber,
            notifications: [],
          })
        })
      })

      describe('when sender is an admin', () => {
        describe('when at least one invitee phone number is invalid', () => {
          const dispatchable = {
            sdMessage: sdMessageOf(channel, `INVITE foo, ${inviteePhoneNumbers[0]}`),
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
                message: CR.invite.success(2),
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
                    message: CR.invite.success(2),
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
                    message: CR.invite.dbErrors(
                      [inviteePhoneNumbers[1]],
                      inviteePhoneNumbers.length,
                    ),
                    notifications: [
                      {
                        recipient: inviteePhoneNumbers[0],
                        message: messagesIn(
                          vouchingOnChannel.language,
                        ).notifications.inviteReceived(vouchingOnChannel.name),
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
                  message: CR.invite.success(2),
                  notifications: [
                    {
                      recipient: inviteePhoneNumbers[0],
                      message: messagesIn(vouchingOnChannel.language).notifications.inviteReceived(
                        vouchingOnChannel.name,
                      ),
                    },
                    {
                      recipient: inviteePhoneNumbers[1],
                      message: messagesIn(vouchingOnChannel.language).notifications.inviteReceived(
                        vouchingOnChannel.name,
                      ),
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
            messageBody: `INVITE ${inviteePhoneNumbers.join(', ')}, ${inviteePhoneNumbers.join(
              ', ',
            )}`,
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
                message: CR.invite.success(2),
                notifications: [
                  {
                    recipient: inviteePhoneNumbers[0],
                    message: messagesIn(vouchingOnChannel.language).notifications.inviteReceived(
                      vouchingOnChannel.name,
                    ),
                  },
                  {
                    recipient: inviteePhoneNumbers[1],
                    message: messagesIn(vouchingOnChannel.language).notifications.inviteReceived(
                      vouchingOnChannel.name,
                    ),
                  },
                ],
              })
            })
          })
        })

        describe('when sending INVITE in a different language', () => {
          // sender's language is English but they're issuing an invite in Spanish

          const dispatchable = {
            sdMessage: sdMessageOf(channel, `INVITAR ${inviteePhoneNumbers[0]}`),
            channel: vouchingOnChannel,
            sender: admin,
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
              message: CR.invite.success(1),
              notifications: [
                {
                  recipient: inviteePhoneNumbers[0],
                  message: messagesIn(languages.ES).notifications.inviteReceived(
                    vouchingOnChannel.name,
                  ),
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
            message: CR.invite.success(2),
            notifications: [
              {
                recipient: inviteePhoneNumbers[0],
                message: messagesIn(vouchingOnChannel.language).notifications.inviteReceived(
                  vouchingOnChannel.name,
                ),
              },
              {
                recipient: inviteePhoneNumbers[1],
                message: messagesIn(vouchingOnChannel.language).notifications.inviteReceived(
                  vouchingOnChannel.name,
                ),
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
            message: CR.invite.success(2),
            notifications: [
              {
                recipient: inviteePhoneNumbers[0],
                message: messagesIn(vouchingAdminChannel.language).notifications.inviteReceived(
                  vouchingAdminChannel.name,
                ),
              },
              {
                recipient: inviteePhoneNumbers[1],
                message: messagesIn(vouchingAdminChannel.language).notifications.inviteReceived(
                  vouchingAdminChannel.name,
                ),
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
              message: CR.invite.notSubscriber,
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
            message: CR.invite.success(2),
            notifications: [
              {
                recipient: inviteePhoneNumbers[0],
                message: messagesIn(
                  extraVouchedChannel.language,
                ).notifications.vouchedInviteReceived(extraVouchedChannel.name, 1, 2),
              },
              {
                recipient: inviteePhoneNumbers[1],
                message: messagesIn(
                  extraVouchedChannel.language,
                ).notifications.vouchedInviteReceived(extraVouchedChannel.name, 1, 2),
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
          message: CR.invite.success(2),
          notifications: [
            {
              recipient: inviteePhoneNumbers[0],
              message: messagesIn(channel.language).notifications.inviteReceived(channel.name),
            },
            {
              recipient: inviteePhoneNumbers[1],
              message: messagesIn(channel.language).notifications.inviteReceived(channel.name),
            },
          ],
        })
      })
    })
  })

  describe('JOIN command', () => {
    const sdMessage = sdMessageOf(channel, 'JOIN')
    let addSubscriberStub

    beforeEach(() => (addSubscriberStub = sinon.stub(membershipRepository, 'addSubscriber')))

    describe('when vouch mode is on', () => {
      const vouchedChannel = { ...channel, vouchMode: vouchModes.ON }
      const dispatchable = { channel: vouchedChannel, sender: randomPerson, sdMessage }

      it('responds with an ERROR', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.JOIN,
          payload: '',
          status: statuses.ERROR,
          message: CR.join.inviteRequired,
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
              randomPerson.phoneNumber,
              languages.EN,
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
              message: CR.join.success(channel),
              notifications: [],
            })
          })

          it('logs membership creation (if applicable)', async () => {
            await processCommand(dispatchable)
            expect(logIfFirstMembershipStub.callCount).to.eql(1)
            expect(logIfFirstMembershipStub.getCall(0).args).to.eql([randomPerson.phoneNumber])
          })
        })

        describe('when adding subscriber fails', () => {
          beforeEach(() => addSubscriberStub.callsFake(() => Promise.reject('foo')))

          it('returns ERROR status/message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.JOIN,
              payload: '',
              status: statuses.ERROR,
              message: CR.join.error,
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
            message: CR.join.alreadyMember,
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
            message: CR.join.alreadyMember,
            notifications: [],
          })
        })
      })
    })

    describe('when followed by a payload', () => {
      it('returns an error and message', async () => {
        const dispatchable = {
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'join us tomorrow!'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.JOIN,
          payload: '',
          status: statuses.ERROR,
          message: messagesIn(defaultLanguage).parseErrors.unnecessaryPayload('join'),
          notifications: [],
        })
      })
    })
  })

  describe('LEAVE command', () => {
    const sdMessage = sdMessageOf(channel, 'LEAVE')
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
            message: CR.leave.success,
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
            message: CR.leave.error,
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
          message: CR.leave.notSubscriber,
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
        expect(removeMemberStub.getCall(0).args).to.eql([channel.phoneNumber, sender.phoneNumber])
      })

      it('returns SUCCESS status, message, and notifications', () => {
        expect(result).to.eql({
          command: commands.LEAVE,
          payload: '',
          status: statuses.SUCCESS,
          message: CR.leave.success,
          notifications: bystanderAdminMemberships.map(membership => ({
            recipient: membership.memberPhoneNumber,
            message: messagesIn(membership.language).notifications.adminLeft,
          })),
        })
      })
    })

    describe('when followed by a payload', () => {
      it('returns an error and message', async () => {
        const dispatchable = {
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'leave that to us'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.LEAVE,
          payload: '',
          status: statuses.ERROR,
          message: messagesIn(defaultLanguage).parseErrors.unnecessaryPayload('leave'),
          notifications: [],
        })
      })
    })
  })

  describe('PRIVATE command', () => {
    let sendMessageStub
    const sdMessage = sdMessageOf(channel, 'PRIVATE hello this is private!')

    beforeEach(async () => {
      sendMessageStub = sinon.stub(signal, 'sendMessage')
    })

    describe('when sender is not an admin', () => {
      const dispatchable = { channel, sender: subscriber, sdMessage }

      it('returns an error message to sender', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.PRIVATE,
          payload: 'hello this is private!',
          status: statuses.UNAUTHORIZED,
          message: CR.private.notAdmin,
          notifications: [],
        })
      })
    })

    describe('when sender is an admin', () => {
      const dispatchable = { channel, sender: admin, sdMessage }

      it('returns a success status', async () => {
        const result = await processCommand(dispatchable)
        expect(result).to.eql({
          command: commands.PRIVATE,
          payload: 'hello this is private!',
          status: statuses.SUCCESS,
          notifications: [],
        })
      })

      it('only messages admins', async () => {
        await processCommand(dispatchable)
        const bystanderPhoneNumbers = bystanderAdminMemberships
          .concat([admin])
          .map(m => m.memberPhoneNumber)
          .sort()
        const sendMessageNumbers = sendMessageStub
          .getCalls()
          .map(call => call.args[0])
          .sort()
        expect(sendMessageNumbers).to.eql(bystanderPhoneNumbers)
      })

      it('handles a signal sendMessage error', async () => {
        sendMessageStub.returns(Promise.reject('signal failure'))

        const result = await processCommand(dispatchable)
        expect(result).to.eql({
          command: commands.PRIVATE,
          message: messagesIn(subscriber.language).commandResponses.private.signalError,
          payload: 'hello this is private!',
          status: statuses.ERROR,
          notifications: [],
        })
      })
    })
  })

  describe('REMOVE command', () => {
    const removalTargetNumber = channel.memberships[1].memberPhoneNumber
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
        const sdMessage = sdMessageOf(channel, `REMOVE ${removalTargetNumber}`)
        const dispatchable = { channel, sender, sdMessage }
        beforeEach(() => validateStub.returns(true))

        describe('when removal target is an admin', () => {
          beforeEach(() => resolveMemberTypeStub.returns(Promise.resolve(memberTypes.ADMIN)))

          it("attempts to remove the admin from the chanel's admins", async () => {
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
                message: CR.remove.success(removalTargetNumber),
                notifications: [
                  // removed
                  {
                    recipient: removalTargetNumber,
                    message: messagesIn(languages.EN).notifications.toRemovedAdmin,
                  },
                  // bystanders
                  {
                    recipient: channel.memberships[2].memberPhoneNumber,
                    message: messagesIn(languages.EN).notifications.adminRemoved,
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
                message: CR.remove.dbError(removalTargetNumber),
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
                message: CR.remove.success(removalTargetNumber),
                notifications: [
                  // removed
                  {
                    recipient: removalTargetNumber,
                    message: messagesIn(languages.EN).notifications.toRemovedSubscriber,
                  },
                  // bystanders
                  {
                    recipient: channel.memberships[2].memberPhoneNumber,
                    message: messagesIn(languages.EN).notifications.subscriberRemoved,
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
              message: CR.remove.targetNotMember(removalTargetNumber),
              notifications: [],
            })
          })
        })
      })

      describe('when payload is not a valid phone number', async () => {
        const sdMessage = sdMessageOf(channel, 'REMOVE foo')
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
            message: CR.remove.invalidPhoneNumber('foo'),
            notifications: [],
          })
        })
      })
    })

    describe('when sender is not an admin', () => {
      const sdMessage = sdMessageOf(channel, `REMOVE ${removalTargetNumber}`)
      const dispatchable = { channel, sender: randomPerson, sdMessage }
      let result

      beforeEach(async () => (result = await processCommand(dispatchable)))

      it('does not attempt to add admin', () => {
        expect(removeMemberStub.callCount).to.eql(0)
      })

      it('returns an SUCCESS status / message', () => {
        expect(result).to.eql({
          command: commands.REMOVE,
          payload: removalTargetNumber,
          status: statuses.UNAUTHORIZED,
          message: CR.remove.notAdmin,
          notifications: [],
        })
      })
    })
  })

  describe('RENAME command', () => {
    const sdMessage = sdMessageOf(channel, 'RENAME foo')
    let updateStub
    beforeEach(() => (updateStub = sinon.stub(channelRepository, 'update')))

    describe('when sender is an admin', () => {
      const sender = admin
      const dispatchable = { channel, sender, sdMessage }
      let result

      describe('when renaming succeeds', () => {
        beforeEach(async () => {
          updateStub.returns(Promise.resolve({ ...channel, name: 'foo' }))
          result = await processCommand(dispatchable)
        })

        it('returns SUCCESS status, message, and notifications', () => {
          expect(result).to.eql({
            command: commands.RENAME,
            payload: 'foo',
            status: statuses.SUCCESS,
            message: CR.rename.success(channel.name, 'foo'),
            notifications: [
              ...bystanderAdminMemberships.map(membership => ({
                recipient: membership.memberPhoneNumber,
                message: messagesIn(membership.language).notifications.channelRenamed(
                  channel.name,
                  'foo',
                ),
              })),
            ],
          })
        })
      })

      describe('when renaming fails', () => {
        beforeEach(async () => {
          updateStub.callsFake(() => Promise.reject('oh noes!'))
          result = await processCommand(dispatchable)
        })

        it('returns ERROR status / message', () => {
          expect(result).to.eql({
            command: commands.RENAME,
            payload: 'foo',
            status: statuses.ERROR,
            message: CR.rename.dbError(channel.name, 'foo'),
            notifications: [],
          })
        })
      })
    })

    describe('when sender is a subscriber', () => {
      const dispatchable = { channel, sender: subscriber, sdMessage }

      it('returns UNAUTHORIZED status / message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RENAME,
          payload: 'foo',
          status: statuses.UNAUTHORIZED,
          message: CR.rename.notAdmin,
          notifications: [],
        })
      })
    })

    describe('when sender is a random person', () => {
      const dispatchable = { channel, sender: randomPerson, sdMessage }

      it('returns UNAUTHORIZED status / message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RENAME,
          payload: 'foo',
          status: statuses.UNAUTHORIZED,
          message: CR.rename.notAdmin,
          notifications: [],
        })
      })
    })
  })

  describe('REPLY command', () => {
    const messageId = 1312
    const crFR = messagesIn(languages.FR).commandResponses
    const dispatchable = {
      channel,
      sender: { ...admin, language: languages.FR },
      sdMessage: sdMessageOf(channel, 'REPLY #1312 foo'),
    }

    let findMemberPhoneNumberStub, findMembershipStub
    beforeEach(() => {
      findMemberPhoneNumberStub = sinon.stub(hotlineMessageRepository, 'findMemberPhoneNumber')
      findMembershipStub = sinon.stub(membershipRepository, 'findMembership')
    })

    describe('when sender is an admin', () => {
      describe('when hotline message id exists', () => {
        beforeEach(() => {})

        describe('when hotline message was from a subscriber', () => {
          beforeEach(() => {
            findMemberPhoneNumberStub.returns(Promise.resolve(subscriber.phoneNumber))
            findMembershipStub.returns(Promise.resolve(subscriber))
          })

          it('returns SUCCESS with notifications for admins and subscriber associated with id', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.REPLY,
              status: statuses.SUCCESS,
              message: `[RÉPONSE AU HOTLINE #${messageId}]\nfoo`,
              notifications: [
                {
                  recipient: subscriber.phoneNumber,
                  message: '[PRIVATE REPLY FROM ADMINS]\nfoo',
                },
                ...bystanderAdminMemberships.map(({ memberPhoneNumber }) => ({
                  recipient: memberPhoneNumber,
                  message: `[REPLY TO HOTLINE #${messageId}]\nfoo`,
                })),
              ],
              payload: { messageId: 1312, reply: 'foo' },
            })
          })
        })
      })

      describe('when hotline message was from a non-subscriber', () => {
        beforeEach(() => {
          findMemberPhoneNumberStub.returns(Promise.resolve(randomPerson.phoneNumber))
          findMembershipStub.returns(null)
        })

        it('returns SUCCESS with notifications for admins and subscriber associated with id', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.REPLY,
            status: statuses.SUCCESS,
            message: `[RÉPONSE AU HOTLINE #${messageId}]\nfoo`,
            notifications: [
              {
                recipient: randomPerson.phoneNumber,
                message: '[PRIVATE REPLY FROM ADMINS]\nfoo',
              },
              ...bystanderAdminMemberships.map(({ memberPhoneNumber }) => ({
                recipient: memberPhoneNumber,
                message: `[REPLY TO HOTLINE #${messageId}]\nfoo`,
              })),
            ],
            payload: { messageId: 1312, reply: 'foo' },
          })
        })
      })

      describe('when hotline message id does not exist', () => {
        beforeEach(() => findMemberPhoneNumberStub.callsFake(() => Promise.reject()))

        it('returns ERROR status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.REPLY,
            status: statuses.ERROR,
            message: crFR.hotlineReply.invalidMessageId(messageId),
            notifications: [],
            payload: { messageId: 1312, reply: 'foo' },
          })
        })
      })
    })

    describe('when sender is not an admin', () => {
      const _dispatchable = { ...dispatchable, sender: subscriber }

      it('returns UNAUTHORIZED status', async () => {
        expect(await processCommand(_dispatchable)).to.eql({
          command: commands.REPLY,
          status: statuses.UNAUTHORIZED,
          message: CR.hotlineReply.notAdmin,
          notifications: [],
          payload: { messageId: 1312, reply: 'foo' },
        })
      })
    })
  })

  describe('SET_LANGUAGE commands', () => {
    const dispatchable = {
      channel,
      sender: subscriber,
      sdMessage: sdMessageOf(channel, 'francais'),
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

    describe('when followed by a payload', () => {
      it('returns an error and message', async () => {
        const dispatchable = {
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'english muffins are ready!'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.SET_LANGUAGE,
          payload: '',
          status: statuses.ERROR,
          message: messagesIn(defaultLanguage).parseErrors.unnecessaryPayload('english'),
          notifications: [],
        })
      })
    })
  })

  describe('TOGGLE commands', () => {
    let updateChannelStub
    beforeEach(() => (updateChannelStub = sinon.stub(channelRepository, 'update')))

    const scenarios = [
      {
        ...toggles.HOTLINE,
        isOn: true,
        command: commands.HOTLINE_ON,
        commandStr: 'HOTLINE ON',
      },
      {
        ...toggles.HOTLINE,
        isOn: false,
        command: commands.HOTLINE_OFF,
        commandStr: 'HOTLINE OFF',
      },
    ]

    scenarios.forEach(({ name, dbField, isOn, command, commandStr }) => {
      describe('when sender is an admin', () => {
        const sender = admin

        const sdMessage = sdMessageOf(channel, commandStr)
        const dispatchable = { channel, sender, sdMessage }

        it('attempts to update the toggle field on the channel db record', async () => {
          updateChannelStub.returns(Promise.resolve())
          await processCommand(dispatchable)
          expect(updateChannelStub.getCall(0).args).to.have.deep.members([
            channel.phoneNumber,
            { [dbField]: isOn },
          ])
        })

        describe('when db update succeeds', () => {
          const notificationMsg = messagesIn(sender.language).notifications.toggles[name].success(
            isOn,
          )

          beforeEach(() => updateChannelStub.returns(Promise.resolve()))

          it('returns a SUCCESS status, message, and notifications', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command,
              status: statuses.SUCCESS,
              payload: '',
              message: CR.toggles[name].success(isOn),
              notifications: [
                ...bystanderAdminMemberships.map(membership => ({
                  recipient: membership.memberPhoneNumber,
                  message: notificationMsg,
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
              message: CR.toggles[name].dbError(isOn),
              notifications: [],
            })
          })
        })
      })

      describe('when sender is a subscriber', () => {
        const sender = subscriber
        const sdMessage = sdMessageOf(channel, commandStr)
        const dispatchable = { channel, sender, sdMessage }

        it('returns an UNAUTHORIZED status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command,
            payload: '',
            status: statuses.UNAUTHORIZED,
            message: CR.toggles[name].notAdmin,
            notifications: [],
          })
        })
      })

      describe('when sender is a random person', () => {
        const sender = randomPerson
        const sdMessage = sdMessageOf(channel, commandStr)
        const dispatchable = { channel, sender, sdMessage }

        it('returns an UNAUTHORIZED status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command,
            payload: '',
            status: statuses.UNAUTHORIZED,
            message: CR.toggles[name].notAdmin,
            notifications: [],
          })
        })
      })
    })

    describe('when toggle is followed by a payload', () => {
      scenarios.forEach(({ commandStr, command }) => {
        const dispatchable = {
          channel,
          sender: admin,
          sdMessage: sdMessageOf(channel, `${commandStr} foo`),
        }
        it('returns an error and message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command,
            payload: '',
            status: statuses.ERROR,
            message: messagesIn(admin.language).parseErrors.unnecessaryPayload(commandStr),
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
        commandStr: 'VOUCHING ON',
        mode: 'ON',
      },
      {
        command: commands.VOUCHING_OFF,
        commandStr: 'VOUCHING OFF',
        mode: 'OFF',
      },
      {
        command: commands.VOUCHING_ADMIN,
        commandStr: 'VOUCHING ADMIN',
        mode: 'ADMIN',
      },
    ]

    vouchingScenarios.forEach(({ command, commandStr, mode }) => {
      describe('when sender is an admin', () => {
        const sender = admin

        const sdMessage = sdMessageOf(channel, commandStr)
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
          const notificationMsg = messagesIn(sender.language).notifications.vouchModeChanged(
            vouchModes[mode],
          )

          beforeEach(() => updateChannelStub.returns(Promise.resolve()))

          it('returns a SUCCESS status, message, and notifications', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command,
              status: statuses.SUCCESS,
              payload: '',
              message: CR.vouchMode.success(vouchModes[mode]),
              notifications: [
                ...bystanderAdminMemberships.map(membership => ({
                  recipient: membership.memberPhoneNumber,
                  message: notificationMsg,
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
              message: CR.vouchMode.dbError,
              notifications: [],
            })
          })
        })
      })

      describe('when sender is a subscriber', () => {
        const sender = subscriber
        const sdMessage = sdMessageOf(channel, commandStr)
        const dispatchable = { channel, sender, sdMessage }

        it('returns an UNAUTHORIZED status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command,
            payload: '',
            status: statuses.UNAUTHORIZED,
            message: CR.vouchMode.notAdmin,
            notifications: [],
          })
        })
      })

      describe('when sender is a random person', () => {
        const sender = randomPerson
        const sdMessage = sdMessageOf(channel, commandStr)
        const dispatchable = { channel, sender, sdMessage }

        it('returns an UNAUTHORIZED status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command,
            payload: '',
            status: statuses.UNAUTHORIZED,
            message: CR.vouchMode.notAdmin,
            notifications: [],
          })
        })
      })
    })

    describe('when VOUCHING command is followed by a payload', () => {
      vouchingScenarios.forEach(({ commandStr, command }) => {
        const dispatchable = {
          channel,
          sender: admin,
          sdMessage: sdMessageOf(channel, `${commandStr} foo`),
        }
        it('returns an error and message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command,
            payload: '',
            status: statuses.ERROR,
            message: messagesIn(admin.language).parseErrors.unnecessaryPayload(commandStr),
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
        const sdMessage = sdMessageOf(channel, `VOUCH LEVEL ${validVouchLevel}`)
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
              message: messagesIn(channel.language).commandResponses.vouchLevel.success(
                validVouchLevel,
              ),
              payload: `${validVouchLevel}`,
              notifications: [
                ...bystanderAdminMemberships.map(membership => ({
                  recipient: membership.memberPhoneNumber,
                  message: messagesIn(membership.language).notifications.vouchLevelChanged(
                    validVouchLevel,
                  ),
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
              message: CR.vouchLevel.dbError,
              payload: `${validVouchLevel}`,
              notifications: [],
            })
          })
        })
      })

      describe('when sender sets an invalid vouch level', () => {
        const sdMessage = sdMessageOf(channel, `VOUCH LEVEL ${invalidVouchLevel}`)
        const dispatchable = { channel, sender, sdMessage }

        beforeEach(async () => {
          updateStub.returns(Promise.resolve({ ...channel, vouchLevel: invalidVouchLevel }))
          result = await processCommand(dispatchable)
        })

        it('returns an ERROR status/message', () => {
          expect(result).to.eql({
            command: commands.VOUCH_LEVEL,
            status: statuses.ERROR,
            message: messagesIn(channel.language).commandResponses.vouchLevel.invalid(
              invalidVouchLevel,
            ),
            payload: `${invalidVouchLevel}`,
            notifications: [],
          })
        })
      })
    })

    describe('when sender is not an admin', () => {
      const sender = randomPerson

      const sdMessage = sdMessageOf(channel, `VOUCH LEVEL ${validVouchLevel}`)
      const dispatchable = { channel, sender, sdMessage }

      it('returns an UNAUTHORIZED status/message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.VOUCH_LEVEL,
          status: statuses.UNAUTHORIZED,
          message: CR.vouchLevel.notAdmin,
          payload: `${validVouchLevel}`,
          notifications: [],
        })
      })
    })
  })

  describe('DESCRIPTION command', () => {
    const sdMessage = sdMessageOf(channel, 'DESCRIPTION foo channel description')
    let updateStub
    beforeEach(() => (updateStub = sinon.stub(channelRepository, 'update')))

    describe('when sender is an admin', () => {
      const dispatchable = { channel, sender: admin, sdMessage }
      let result

      describe('when update of descriptions succeeds', () => {
        beforeEach(async () => {
          updateStub.returns(
            Promise.resolve({ ...channel, description: 'foo channel description' }),
          )
          result = await processCommand(dispatchable)
        })

        it('returns SUCCESS status / message', () => {
          expect(result).to.eql({
            command: commands.SET_DESCRIPTION,
            status: statuses.SUCCESS,
            payload: 'foo channel description',
            message: CR.description.success('foo channel description'),
            notifications: [
              ...bystanderAdminMemberships.map(membership => ({
                recipient: membership.memberPhoneNumber,
                message: messagesIn(membership.language).notifications.setDescription(
                  'foo channel description',
                ),
              })),
            ],
          })
        })
      })

      describe('when update of descriptions fails', () => {
        beforeEach(async () => {
          updateStub.callsFake(() => Promise.reject('oh noes!'))
          result = await processCommand(dispatchable)
        })

        it('returns ERROR status / message', () => {
          expect(result).to.eql({
            command: commands.SET_DESCRIPTION,
            payload: 'foo channel description',
            status: statuses.ERROR,
            message: CR.description.dbError,
            notifications: [],
          })
        })
      })
    })
    describe('when sender is a subscriber', () => {
      const dispatchable = { channel, sender: subscriber, sdMessage }

      it('returns UNAUTHORIZED status / message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.SET_DESCRIPTION,
          payload: 'foo channel description',
          status: statuses.UNAUTHORIZED,
          message: CR.rename.notAdmin,
          notifications: [],
        })
      })
    })
    describe('when sender is a random person', () => {
      const dispatchable = { channel, sender: randomPerson, sdMessage }

      it('returns UNAUTHORIZED status / message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.SET_DESCRIPTION,
          payload: 'foo channel description',
          status: statuses.UNAUTHORIZED,
          message: CR.rename.notAdmin,
          notifications: [],
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
          sdMessage: sdMessageOf(channel, 'foo'),
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
        it('returns a success status', async () => {
          const sender = subscriber
          const dispatchable = {
            channel: { ...channel, hotlineOn: true },
            sender,
            sdMessage: sdMessageOf(channel, 'foo'),
          }
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.NONE,
            payload: '',
            status: statuses.SUCCESS,
            message: '',
            notifications: [],
          })
        })
      })

      describe('when the hotline is disabled', () => {
        it('returns an error and message', async () => {
          const sender = subscriber
          const dispatchable = {
            channel: { ...channel, hotlineOn: false },
            sender,
            sdMessage: sdMessageOf(channel, 'foo'),
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
