import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import { processCommand } from '../../../../../app/services/dispatcher/commands'
import { commands, toggles } from '../../../../../app/services/dispatcher/commands/constants'
import { statuses } from '../../../../../app/services/util'
import { languages } from '../../../../../app/services/language'
import { commandResponses as CR } from '../../../../../app/services/dispatcher/strings/messages/EN'
import signal from '../../../../../app/services/signal'
import channelRepository from '../../../../../app/db/repositories/channel'
import inviteRepository from '../../../../../app/db/repositories/invite'
import membershipRepository from '../../../../../app/db/repositories/membership'
import deauthorizationRepository from '../../../../../app/db/repositories/deauthorization'
import hotlineMessageRepository from '../../../../../app/db/repositories/hotlineMessage'
import phoneNumberService from '../../../../../app/services/registrar/phoneNumber'
import validator from '../../../../../app/db/validations/phoneNumber'
import { subscriptionFactory } from '../../../../support/factories/subscription'
import { genPhoneNumber, parenthesize } from '../../../../support/factories/phoneNumber'
import { memberTypes } from '../../../../../app/db/repositories/membership'
import { sdMessageOf } from '../../../../../app/services/signal'
import {
  adminMembershipFactory,
  membershipFactory,
  subscriberMembershipFactory,
} from '../../../../support/factories/membership'
import { messagesIn } from '../../../../../app/services/dispatcher/strings/messages'
import { deauthorizationFactory } from '../../../../support/factories/deauthorization'
const {
  signal: { signupPhoneNumber },
} = require('../../../../../app/config')

describe('executing commands', () => {
  const db = {}
  const channel = {
    name: 'foobar',
    description: 'foobar channel description',
    phoneNumber: '+13333333333',
    deauthorizations: [deauthorizationFactory()],
    memberships: [
      ...times(3, () => adminMembershipFactory({ channelPhoneNumber: '+13333333333' })),
      ...times(2, () => subscriberMembershipFactory({ channelPhoneNumber: '+13333333333' })),
    ],
    messageCount: { broadcastIn: 42 },
  }
  const bystanderAdminMemberships = channel.memberships.slice(1, 3)
  const signupChannel = {
    name: 'SB_SIGNUP',
    phoneNumber: signupPhoneNumber,
    publications: channel.publications,
  }
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

  describe('ACCEPT command', () => {
    const dispatchable = {
      db,
      channel: { ...channel, vouchingOn: true, vouchLevel: 1 },
      sender: randomPerson,
      sdMessage: sdMessageOf(channel, 'ACCEPT'),
    }
    let isMemberStub, countInvitesStub, acceptStub
    beforeEach(() => {
      isMemberStub = sinon.stub(membershipRepository, 'isMember')
      countInvitesStub = sinon.stub(inviteRepository, 'count')
      acceptStub = sinon.stub(inviteRepository, 'accept')
    })
    afterEach(() => {
      isMemberStub.restore()
      countInvitesStub.restore()
      acceptStub.restore()
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

      describe('when vouching is on', () => {
        describe('when sender lacks sufficient invites', () => {
          // vouching level is 1 by default; accepter possesses 0 invites
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

      describe('when vouching is off and user has no invites', () => {
        const _dispatchable = { ...dispatchable, channel }
        beforeEach(() => countInvitesStub.returns(Promise.resolve(0)))

        describe('when accept db call succeeds', () => {
          beforeEach(() => acceptStub.returns(Promise.resolve([membershipFactory(), 1])))

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
      it('returns a NOOP', async () => {
        const _dispatchable = { ...dispatchable, sdMessage: sdMessageOf(channel, 'accept my life') }
        expect(await processCommand(_dispatchable)).to.eql({
          command: commands.NOOP,
          payload: '',
          status: statuses.NOOP,
          message: '',
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
    afterEach(() => {
      addAdminStub.restore()
      trustStub.restore()
      destroyDeauthStub.restore()
    })

    describe('when sender is an admin', () => {
      const sender = admin

      describe('when payload is a valid phone number', () => {
        const sdMessage = sdMessageOf(channel, `ADD ${rawNewAdminPhoneNumber}`)
        // to simulate situation in which we have not yet added the admin...
        const _channel = { ...channel, memberships: channel.memberships.slice(1) }
        const dispatchable = { db, channel: _channel, sender, sdMessage }

        beforeEach(() => addAdminStub.returns(Promise.resolve()))

        it("attempts to add payload number to the channel's admins", async () => {
          await processCommand(dispatchable)
          expect(addAdminStub.getCall(0).args).to.eql([
            db,
            channel.phoneNumber,
            newAdminPhoneNumber,
          ])
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
          const dispatchable = { db, channel, sender, sdMessage }

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
        const dispatchable = { db, channel, sender, sdMessage: sdMessageOf(channel, 'ADD foo') }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not attempt to add admin', () => {
          expect(addAdminStub.callCount).to.eql(0)
        })

        it('returns a ERROR status/message', () => {
          expect(result).to.eql({
            command: commands.ADD,
            payload: 'foo',
            status: statuses.ERROR,
            message: CR.add.invalidPhoneNumber('foo'),
            notifications: [],
          })
        })
      })
    })

    describe('when sender is not an admin', () => {
      const dispatchable = {
        db,
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

  describe('DECLINE command', () => {
    const dispatchable = {
      db,
      channel,
      sender: randomPerson,
      sdMessage: sdMessageOf(channel, 'DECLINE'),
    }

    let declineStub
    beforeEach(() => (declineStub = sinon.stub(inviteRepository, 'decline')))
    afterEach(() => declineStub.restore())

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
      it('returns a NOOP', async () => {
        const _dispatchable = { ...dispatchable, sdMessage: sdMessageOf(channel, 'decline this') }
        expect(await processCommand(_dispatchable)).to.eql({
          command: commands.NOOP,
          payload: '',
          status: statuses.NOOP,
          message: '',
          notifications: [],
        })
      })
    })
  })

  describe('DESTROY command', () => {
    const _dispatchable = { db, channel, sdMessage: sdMessageOf(channel, 'DESTROY') }

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
      db,
      channel,
      sdMessage: sdMessageOf(channel, 'CONFIRM DESTROY'),
    }

    let destroyStub
    beforeEach(() => (destroyStub = sinon.stub(phoneNumberService, 'destroy')))
    afterEach(() => destroyStub.restore())

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
      const dispatchable = { db, channel, sender: admin, sdMessage }

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
      const dispatchable = { db, channel, sender: subscriber, sdMessage }

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
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }

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
      it('returns a NOOP', async () => {
        const dispatchable = {
          db,
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'help me find the march'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.NOOP,
          payload: '',
          status: statuses.NOOP,
          message: '',
          notifications: [],
        })
      })
    })
  })

  describe('INFO command', () => {
    const sdMessage = sdMessageOf(channel, 'INFO')

    describe('when sender is an admin', () => {
      const dispatchable = { db, channel, sender: admin, sdMessage }

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
      const dispatchable = { db, channel, sender: subscriber, sdMessage }

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
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }

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
      it('returns a NOOP', async () => {
        const dispatchable = {
          db,
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'info wars did it'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.NOOP,
          payload: '',
          status: statuses.NOOP,
          message: '',
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
    afterEach(() => {
      isMemberStub.restore()
      issueInviteStub.restore()
      countInvitesStub.restore()
    })

    describe('when vouching mode is on', () => {
      const vouchingChannel = { ...channel, vouchingOn: true, vouchLevel: 1 }

      describe('when sender is not a member of channel', () => {
        const dispatchable = { db, sdMessage, channel: vouchingChannel, sender: randomPerson }

        it('returns UNAUTHORIZED', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.INVITE,
            payload: inviteePhoneNumbers,
            status: statuses.UNAUTHORIZED,
            message: CR.invite.unauthorized,
            notifications: [],
          })
        })
      })

      describe('when sender is an admin', () => {
        describe('when at least one invitee phone number is invalid', () => {
          const dispatchable = {
            db,
            sdMessage: sdMessageOf(channel, `INVITE foo, ${inviteePhoneNumbers[0]}`),
            channel: vouchingChannel,
            sender: admin,
          }

          it('returns ERROR', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.INVITE,
              payload: `foo, ${inviteePhoneNumbers[0]}`,
              status: statuses.ERROR,
              message: messagesIn('EN').parseErrors.invalidPhoneNumber('foo'),
              notifications: [],
            })
          })
        })

        describe('when all invitee numbers are valid (and unique)', () => {
          const dispatchable = { db, sdMessage, channel: vouchingChannel, sender: admin }

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
                        message: messagesIn(vouchingChannel.language).notifications.inviteReceived(
                          vouchingChannel.name,
                        ),
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
                      message: messagesIn(vouchingChannel.language).notifications.inviteReceived(
                        vouchingChannel.name,
                      ),
                    },
                    {
                      recipient: inviteePhoneNumbers[1],
                      message: messagesIn(vouchingChannel.language).notifications.inviteReceived(
                        vouchingChannel.name,
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
            db,
            sdMessage: _sdMessage,
            channel: vouchingChannel,
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
                    message: messagesIn(vouchingChannel.language).notifications.inviteReceived(
                      vouchingChannel.name,
                    ),
                  },
                  {
                    recipient: inviteePhoneNumbers[1],
                    message: messagesIn(vouchingChannel.language).notifications.inviteReceived(
                      vouchingChannel.name,
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
            db,
            sdMessage: sdMessageOf(channel, `INVITAR ${inviteePhoneNumbers[0]}`),
            channel: vouchingChannel,
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
                    vouchingChannel.name,
                  ),
                },
              ],
            })
          })
        })
      })

      describe('when sender is a subscriber on happy path', () => {
        const dispatchable = { db, sdMessage, channel: vouchingChannel, sender: subscriber }
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
                message: messagesIn(vouchingChannel.language).notifications.inviteReceived(
                  vouchingChannel.name,
                ),
              },
              {
                recipient: inviteePhoneNumbers[1],
                message: messagesIn(vouchingChannel.language).notifications.inviteReceived(
                  vouchingChannel.name,
                ),
              },
            ],
          })
        })
      })
    })

    describe('when vouching mode is on and set to greater than 1', () => {
      describe('sender is an admin and invitees are not yet subscribers or invited', () => {
        const extraVouchedChannel = { ...channel, vouchingOn: true, vouchLevel: 2 }
        const dispatchable = { db, sdMessage, channel: extraVouchedChannel, sender: admin }
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

    describe('when vouching mode is off', () => {
      const dispatchable = { db, channel, sender: admin, sdMessage }

      it('has same behavior as vouching on', async () => {
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
    afterEach(() => addSubscriberStub.restore())

    describe('when vouching mode is on', () => {
      const vouchedChannel = { ...channel, vouchingOn: true }
      const dispatchable = { db, channel: vouchedChannel, sender: randomPerson, sdMessage }

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

    describe('when vouching mode is off', () => {
      describe('when number is not subscribed to channel', () => {
        const dispatchable = { db, channel, sender: randomPerson, sdMessage }

        describe('in all cases', () => {
          beforeEach(() => addSubscriberStub.returns(Promise.resolve()))

          it('attempts to subscribe sender to channel in the language they used to signup', async () => {
            await processCommand(dispatchable)
            expect(addSubscriberStub.getCall(0).args).to.eql([
              db,
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
        const dispatchable = { db, channel, sender: subscriber, sdMessage }
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
        const dispatchable = { db, channel, sender: admin, sdMessage }
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
      it('returns a NOOP', async () => {
        const dispatchable = {
          db,
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'join us tomorrow!'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.NOOP,
          payload: '',
          status: statuses.NOOP,
          message: '',
          notifications: [],
        })
      })
    })
  })

  describe('LEAVE command', () => {
    const sdMessage = sdMessageOf(channel, 'LEAVE')
    let removeMemberStub
    beforeEach(() => (removeMemberStub = sinon.stub(membershipRepository, 'removeMember')))
    afterEach(() => removeMemberStub.restore())

    describe('when sender is subscribed to channel', () => {
      const dispatchable = { db, channel, sender: subscriber, sdMessage }
      beforeEach(() => removeMemberStub.returns(Promise.resolve()))

      it('attempts to remove subscriber', async () => {
        await processCommand(dispatchable)
        expect(removeMemberStub.getCall(0).args).to.eql([
          db,
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
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }
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
      const dispatchable = { db, channel, sender, sdMessage }

      beforeEach(async () => {
        removeMemberStub.returns(Promise.resolve([1, 1]))
        result = await processCommand(dispatchable)
      })

      it('removes sender as admin of channel', async () => {
        expect(removeMemberStub.getCall(0).args).to.eql([
          db,
          channel.phoneNumber,
          sender.phoneNumber,
        ])
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
      it('returns a NOOP', async () => {
        const dispatchable = {
          db,
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'leave that to us'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.NOOP,
          payload: '',
          status: statuses.NOOP,
          message: '',
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

    afterEach(() => {
      sendMessageStub.restore()
    })

    describe('when sender is not an admin', () => {
      const dispatchable = { db, channel, sender: subscriber, sdMessage }

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
      const dispatchable = { db, channel, sender: admin, sdMessage }

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
          .map(call => call.args[1])
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
    let validateStub, isAdminStub, removeMemberStub, resolveMemberTypeStub

    beforeEach(() => {
      validateStub = sinon.stub(validator, 'validatePhoneNumber')
      isAdminStub = sinon.stub(membershipRepository, 'isAdmin')
      removeMemberStub = sinon.stub(membershipRepository, 'removeMember')
      resolveMemberTypeStub = sinon.stub(membershipRepository, 'resolveMemberType')
    })

    afterEach(() => {
      validateStub.restore()
      isAdminStub.restore()
      removeMemberStub.restore()
      resolveMemberTypeStub.restore()
    })

    describe('when sender is an admin', () => {
      const sender = admin
      beforeEach(() => removeMemberStub.returns(Promise.resolve()))

      describe('when payload is a valid phone number', () => {
        const sdMessage = sdMessageOf(channel, `REMOVE ${removalTargetNumber}`)
        const dispatchable = { db, channel, sender, sdMessage }
        beforeEach(() => validateStub.returns(true))

        describe('when removal target is an admin', () => {
          beforeEach(() => resolveMemberTypeStub.returns(Promise.resolve(memberTypes.ADMIN)))

          it("attempts to remove the admin from the chanel's admins", async () => {
            await processCommand(dispatchable)
            expect(removeMemberStub.getCall(0).args).to.eql([
              db,
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
              db,
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
        const dispatchable = { db, channel, sender, sdMessage }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not attempt to remove admin', () => {
          expect(removeMemberStub.callCount).to.eql(0)
        })

        it('returns a SUCCESS status / NOOP message', () => {
          expect(result).to.eql({
            command: commands.REMOVE,
            payload: 'foo',
            status: statuses.ERROR,
            message: CR.remove.invalidPhoneNumber('foo'),
            notifications: [],
          })
        })
      })
    })

    describe('when sender is not an admin', () => {
      const sdMessage = sdMessageOf(channel, `REMOVE ${removalTargetNumber}`)
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }
      let result

      beforeEach(async () => (result = await processCommand(dispatchable)))

      it('does not attempt to add admin', () => {
        expect(removeMemberStub.callCount).to.eql(0)
      })

      it('returns an SUCCESS status / NOT_NOOP message', () => {
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
    afterEach(() => updateStub.restore())

    describe('when sender is an admin', () => {
      const sender = admin
      const dispatchable = { db, channel, sender, sdMessage }
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
      const dispatchable = { db, channel, sender: subscriber, sdMessage }

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
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }

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
      db,
      channel,
      sender: { ...admin, language: languages.FR },
      sdMessage: sdMessageOf(channel, 'REPLY #1312 foo'),
    }

    let findMemberPhoneNumberStub, findMembershipStub
    beforeEach(() => {
      findMemberPhoneNumberStub = sinon.stub(hotlineMessageRepository, 'findMemberPhoneNumber')
      findMembershipStub = sinon.stub(membershipRepository, 'findMembership')
    })

    afterEach(() => {
      findMemberPhoneNumberStub.restore()
      findMembershipStub.restore()
    })

    describe('when sender is an admin', () => {
      describe('when hotline message id exists', () => {
        beforeEach(() => {
          findMemberPhoneNumberStub.returns(Promise.resolve(subscriber.phoneNumber))
          findMembershipStub.returns(
            Promise.resolve(
              membershipFactory({
                channel: channel.phoneNumber,
                memberPhoneNumber: subscriber.phoneNumber,
              }),
            ),
          )
        })

        it('returns SUCCESS with notifications for admins and member associated with id', async () => {
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

      describe('when hotline message id does not exist', () => {
        beforeEach(() =>
          findMemberPhoneNumberStub.callsFake(() => Promise.reject(new Error('oh noes!'))),
        )
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
      db,
      channel,
      sender: subscriber,
      sdMessage: sdMessageOf(channel, 'francais'),
    }

    let updateLanguageStub
    beforeEach(() => (updateLanguageStub = sinon.stub(membershipRepository, 'updateLanguage')))
    afterEach(() => updateLanguageStub.restore())

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
      it('returns a NOOP', async () => {
        const dispatchable = {
          db,
          channel,
          sender: randomPerson,
          sdMessage: sdMessageOf(channel, 'english muffins are ready!'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.NOOP,
          payload: '',
          status: statuses.NOOP,
          message: '',
          notifications: [],
        })
      })
    })
  })

  describe('TOGGLE commands', () => {
    let updateChannelStub
    beforeEach(() => (updateChannelStub = sinon.stub(channelRepository, 'update')))
    afterEach(() => updateChannelStub.restore())

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
      {
        ...toggles.VOUCHING,
        isOn: true,
        command: commands.VOUCHING_ON,
        commandStr: 'VOUCHING ON',
      },
      {
        ...toggles.VOUCHING,
        isOn: false,
        command: commands.VOUCHING_OFF,
        commandStr: 'VOUCHING OFF',
      },
    ]

    scenarios.forEach(({ name, dbField, isOn, command, commandStr }) => {
      describe('when sender is an admin', () => {
        const sender = admin

        const sdMessage = sdMessageOf(channel, commandStr)
        const dispatchable = { db, channel, sender, sdMessage }

        it('attempts to update the toggle field on the channel db record', async () => {
          updateChannelStub.returns(Promise.resolve())
          await processCommand(dispatchable)
          expect(updateChannelStub.getCall(0).args).to.have.deep.members([
            db,
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
        const dispatchable = { db, channel, sender, sdMessage }

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
        const dispatchable = { db, channel, sender, sdMessage }

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
      scenarios.forEach(({ commandStr }) => {
        const dispatchable = {
          db,
          channel,
          sender: admin,
          sdMessage: sdMessageOf(channel, `${commandStr} foo`),
        }
        it('returns a NOOP', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.NOOP,
            payload: '',
            status: statuses.NOOP,
            message: '',
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
    afterEach(() => updateStub.restore())

    describe('when sender is an admin', () => {
      const sender = admin
      let result

      describe('when sender sets a valid vouch level', () => {
        const sdMessage = sdMessageOf(channel, `VOUCH LEVEL ${validVouchLevel}`)
        const dispatchable = { db, channel, sender, sdMessage }

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
        const dispatchable = { db, channel, sender, sdMessage }

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
      const dispatchable = { db, channel, sender, sdMessage }

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
    afterEach(() => updateStub.restore())

    describe('when sender is an admin', () => {
      const dispatchable = { db, channel, sender: admin, sdMessage }
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
      const dispatchable = { db, channel, sender: subscriber, sdMessage }

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
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }

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

  describe('new user attempting to JOIN the signup channel', () => {
    it('returns NOOP', async () => {
      const dispatchable = {
        db,
        channel: signupChannel,
        sender: randomPerson,
        sdMessage: sdMessageOf(signupChannel, 'HELLO'),
      }
      expect(await processCommand(dispatchable)).to.eql({
        command: commands.NOOP,
        status: statuses.NOOP,
        message: '',
        notifications: [],
      })
    })
  })

  describe('invalid command', () => {
    it('returns NOOP status/message', async () => {
      const dispatchable = {
        db,
        channel,
        sender: admin,
        sdMessage: sdMessageOf(channel, 'foo'),
      }
      expect(await processCommand(dispatchable)).to.eql({
        command: commands.NOOP,
        payload: '',
        status: statuses.NOOP,
        message: '',
        notifications: [],
      })
    })
  })
})
