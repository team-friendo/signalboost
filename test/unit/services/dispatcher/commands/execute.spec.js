import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import { processCommand } from '../../../../../app/services/dispatcher/commands'
import {
  commands,
  toggles,
  statuses,
} from '../../../../../app/services/dispatcher/commands/constants'
import { languages } from '../../../../../app/constants'
import { commandResponses as CR } from '../../../../../app/services/dispatcher/strings/messages/EN'
import signal from '../../../../../app/services/signal'
import channelRepository from '../../../../../app/db/repositories/channel'
import inviteRepository from '../../../../../app/db/repositories/invite'
import membershipRepository from '../../../../../app/db/repositories/membership'
import deauthorizationRepository from '../../../../../app/db/repositories/deauthorization'
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
    const dispatchable = {
      db,
      channel,
      sender: randomPerson,
      sdMessage: sdMessageOf(channel, 'DESTROY'),
    }

    let destroyStub
    beforeEach(() => (destroyStub = sinon.stub(phoneNumberService, 'destroy')))
    afterEach(() => destroyStub.restore())

    describe('when destroy succeeds', () => {
      it('returns a SUCCESS status', async () => {
        destroyStub.returns({ status: 'SUCCESS' })
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.DESTROY,
          payload: '',
          status: statuses.SUCCESS,
          message: CR.destroy.success,
          notifications: [],
        })
      })
    })

    describe('when a failure occurs', () => {
      it('returns a ERROR status', async () => {
        destroyStub.returns({ status: 'ERROR' })
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.DESTROY,
          payload: '',
          status: statuses.ERROR,
          message: CR.destroy.error,
          notifications: [],
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
    const inviteePhoneNumber = genPhoneNumber()
    const sdMessage = sdMessageOf(channel, `INVITE ${inviteePhoneNumber}`)

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
            payload: inviteePhoneNumber,
            status: statuses.UNAUTHORIZED,
            message: CR.invite.unauthorized,
            notifications: [],
          })
        })
      })

      describe('when sender is an admin', () => {
        describe('when invitee phone number is invalid', () => {
          const dispatchable = {
            db,
            sdMessage: sdMessageOf(channel, 'INVITE foo'),
            channel: vouchingChannel,
            sender: admin,
          }

          it('returns ERROR', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.INVITE,
              payload: 'foo',
              status: statuses.ERROR,
              message: messagesIn('EN').parseErrors.invalidPhoneNumber('foo'),
              notifications: [],
            })
          })
        })

        describe('when invitee number is valid', () => {
          const dispatchable = { db, sdMessage, channel: vouchingChannel, sender: admin }

          describe('when invitee is already member of channel', () => {
            let res
            beforeEach(async () => {
              isMemberStub.returns(Promise.resolve(true))
              res = await processCommand(dispatchable)
            })

            it('does not attempt to issue invite', () => {
              expect(issueInviteStub.callCount).to.eql(0)
            })

            it('returns ERROR status, success message, and no payload', () => {
              expect(res).to.eql({
                command: commands.INVITE,
                payload: inviteePhoneNumber,
                status: statuses.ERROR,
                message: CR.invite.success,
                notifications: [],
              })
            })
          })

          describe('when invitee is not already member of channel', () => {
            beforeEach(() => isMemberStub.returns(Promise.resolve(false)))

            describe('when invitee has already been invited to channel', () => {
              let res
              beforeEach(async () => {
                issueInviteStub.returns(Promise.resolve(false))
                res = await processCommand(dispatchable)
              })

              it('attempts to issue an invite', () => {
                expect(issueInviteStub.callCount).to.eql(1)
              })

              it('returns ERROR and no payload', () => {
                expect(res).to.eql({
                  command: commands.INVITE,
                  payload: inviteePhoneNumber,
                  status: statuses.ERROR,
                  message: CR.invite.success,
                  notifications: [],
                })
              })
            })

            describe('when invitee has not already been invited', () => {
              let res
              beforeEach(async () => {
                issueInviteStub.returns(Promise.resolve(true))
                countInvitesStub.returns(Promise.resolve(1))
                res = await processCommand(dispatchable)
              })

              it('attempts to issue an invite', () => {
                expect(issueInviteStub.callCount).to.eql(1)
              })

              it('returns SUCCESS, message, and notification for invitee', () => {
                expect(res).to.eql({
                  command: commands.INVITE,
                  payload: inviteePhoneNumber,
                  status: statuses.SUCCESS,
                  message: CR.invite.success,
                  notifications: [
                    {
                      recipient: inviteePhoneNumber,
                      message: messagesIn(vouchingChannel.language).notifications.inviteReceived(
                        vouchingChannel.name,
                        1,
                        vouchingChannel.vouchLevel,
                      ),
                    },
                  ],
                })
              })
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
          expect(issueInviteStub.callCount).to.eql(1)
        })

        it('returns SUCCESS with notification for invitee', () => {
          expect(res).to.eql({
            command: commands.INVITE,
            payload: inviteePhoneNumber,
            status: statuses.SUCCESS,
            message: CR.invite.success,
            notifications: [
              {
                recipient: inviteePhoneNumber,
                message: messagesIn(vouchingChannel.language).notifications.inviteReceived(
                  vouchingChannel.name,
                  1,
                  vouchingChannel.vouchLevel,
                ),
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
          payload: inviteePhoneNumber,
          status: statuses.SUCCESS,
          message: CR.invite.success,
          notifications: [
            {
              recipient: inviteePhoneNumber,
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
    let removeSubscriberStub
    beforeEach(() => (removeSubscriberStub = sinon.stub(membershipRepository, 'removeSubscriber')))
    afterEach(() => removeSubscriberStub.restore())

    describe('when sender is subscribed to channel', () => {
      const dispatchable = { db, channel, sender: subscriber, sdMessage }
      beforeEach(() => removeSubscriberStub.returns(Promise.resolve()))

      it('attempts to remove subscriber', async () => {
        await processCommand(dispatchable)
        expect(removeSubscriberStub.getCall(0).args).to.eql([
          db,
          channel.phoneNumber,
          subscriber.phoneNumber,
        ])
      })

      describe('when removing subscriber succeeds', () => {
        beforeEach(() => removeSubscriberStub.returns(Promise.resolve(1)))

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
        beforeEach(() => removeSubscriberStub.callsFake(() => Promise.reject('boom!')))

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
        expect(removeSubscriberStub.callCount).to.eql(0)
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
      let result, removeAdminStub
      const dispatchable = { db, channel, sender, sdMessage }

      beforeEach(async () => {
        removeAdminStub = sinon
          .stub(membershipRepository, 'removeAdmin')
          .returns(Promise.resolve([1, 1]))
        result = await processCommand(dispatchable)
      })
      afterEach(() => removeAdminStub.restore())

      it('removes sender as admin of channel', () => {
        expect(removeAdminStub.getCall(0).args).to.eql([
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

  describe('REMOVE command', () => {
    const removalTargetNumber = channel.memberships[1].memberPhoneNumber
    let validateStub, isAdminStub, removeAdminStub

    beforeEach(() => {
      validateStub = sinon.stub(validator, 'validatePhoneNumber')
      isAdminStub = sinon.stub(membershipRepository, 'isAdmin')
      removeAdminStub = sinon.stub(membershipRepository, 'removeAdmin')
    })

    afterEach(() => {
      validateStub.restore()
      isAdminStub.restore()
      removeAdminStub.restore()
    })

    describe('when sender is an admin', () => {
      const sender = admin
      beforeEach(() => removeAdminStub.returns(Promise.resolve()))

      describe('when payload is a valid phone number', () => {
        const sdMessage = sdMessageOf(channel, `REMOVE ${removalTargetNumber}`)
        const dispatchable = { db, channel, sender, sdMessage }
        beforeEach(() => validateStub.returns(true))

        describe('when removal target is an admin', () => {
          beforeEach(() => isAdminStub.returns(Promise.resolve(true)))

          it("attempts to remove the human from the chanel's admins", async () => {
            await processCommand(dispatchable)
            expect(removeAdminStub.getCall(0).args).to.eql([
              db,
              channel.phoneNumber,
              removalTargetNumber,
            ])
          })

          describe('when removing the admin succeeds', () => {
            beforeEach(() => removeAdminStub.returns(Promise.resolve([1, 1])))

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
            beforeEach(() => removeAdminStub.callsFake(() => Promise.reject('oh noes!')))

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

        describe('when removal target is not an admin', () => {
          beforeEach(() => isAdminStub.returns(Promise.resolve(false)))

          it('does not attempt to remove admin', () => {
            expect(removeAdminStub.callCount).to.eql(0)
          })

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

      describe('when payload is not a valid phone number', async () => {
        const sdMessage = sdMessageOf(channel, 'REMOVE foo')
        const dispatchable = { db, channel, sender, sdMessage }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not attempt to remove admin', () => {
          expect(removeAdminStub.callCount).to.eql(0)
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
        expect(removeAdminStub.callCount).to.eql(0)
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
