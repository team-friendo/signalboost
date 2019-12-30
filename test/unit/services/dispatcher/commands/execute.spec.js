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
import channelRepository from '../../../../../app/db/repositories/channel'
import inviteRepository from '../../../../../app/db/repositories/invite'
import membershipRepository from '../../../../../app/db/repositories/membership'
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
const {
  signal: { signupPhoneNumber },
} = require('../../../../../app/config')

describe('executing commands', () => {
  const db = {}
  const admin = {
    phoneNumber: '+11111111111',
    type: memberTypes.ADMIN,
    language: languages.EN,
  }
  const channel = {
    name: 'foobar',
    phoneNumber: '+13333333333',
    memberships: [
      adminMembershipFactory({
        memberPhoneNumber: admin.phoneNumber,
        channelPhoneNumber: '+13333333333',
      }),
      ...times(3, () => adminMembershipFactory({ channelPhoneNumber: '+13333333333' })),
      ...times(2, () => subscriberMembershipFactory({ channelPhoneNumber: '+13333333333' })),
    ],
    messageCount: { broadcastIn: 42 },
  }
  const bystanderAdminMemberships = channel.memberships.slice(1, 4)
  const signupChannel = {
    name: 'SB_SIGNUP',
    phoneNumber: signupPhoneNumber,
    publications: channel.publications,
  }
  const subscriber = {
    phoneNumber: '+12222222222',
    type: memberTypes.SUBSCRIBER,
    language: languages.EN,
  }
  const randomPerson = {
    phoneNumber: '+13333333333',
    type: memberTypes.NONE,
    language: languages.EN,
  }

  describe('ACCEPT command', () => {
    const dispatchable = {
      db,
      channel: { ...channel, vouchingOn: true },
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
          status: statuses.ERROR,
          message: CR.accept.alreadyMember,
        })
      })
    })

    describe('when sender is not already member of channel', () => {
      beforeEach(() => isMemberStub.returns(Promise.resolve(false)))

      describe('when vouching is on', () => {
        describe('when sender lacks sufficient invites', () => {
          beforeEach(() => countInvitesStub.returns(Promise.resolve(0)))

          it('returns an ERROR status', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.ACCEPT,
              status: statuses.ERROR,
              message: CR.accept.belowThreshold(channel, 1, 0),
            })
          })
        })

        describe('when sender has sufficient invites', () => {
          describe('when accept db call succeeds', () => {
            beforeEach(() => acceptStub.returns(Promise.resolve([membershipFactory(), 1])))

            it('returns SUCCESS status', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.ACCEPT,
                status: statuses.SUCCESS,
                message: CR.accept.success(channel),
              })
            })
          })

          describe('when accept db call fails', () => {
            beforeEach(() => acceptStub.callsFake(() => Promise.reject(new Error('boom!'))))

            it('returns ERROR status', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.ACCEPT,
                status: statuses.ERROR,
                message: CR.accept.dbError,
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
              status: statuses.SUCCESS,
              message: CR.accept.success(channel),
            })
          })
        })

        describe('when accept db call fails', () => {
          beforeEach(() => acceptStub.callsFake(() => Promise.reject(new Error('boom!'))))

          it('returns ERROR status', async () => {
            expect(await processCommand(_dispatchable)).to.eql({
              command: commands.ACCEPT,
              status: statuses.ERROR,
              message: CR.accept.dbError,
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
          status: statuses.ERROR,
          message: CR.accept.dbError,
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
          status: statuses.ERROR,
          message: CR.accept.dbError,
        })
      })
    })
  })

  describe('ADD command', () => {
    let addAdminStub
    beforeEach(() => (addAdminStub = sinon.stub(membershipRepository, 'addAdmin')))
    afterEach(() => addAdminStub.restore())

    describe('when sender is an admin', () => {
      const sender = admin

      describe('when payload is a valid phone number', () => {
        const phoneNumberToAddAsAdmin = channel.memberships[1].memberPhoneNumber
        const rawPhoneNumberToAddAsAdmin = parenthesize(phoneNumberToAddAsAdmin)
        const sdMessage = sdMessageOf(channel, `ADD ${rawPhoneNumberToAddAsAdmin}`)
        const dispatchable = { db, channel, sender, sdMessage }

        beforeEach(() => addAdminStub.returns(Promise.resolve()))

        it("attempts to add payload number to the channel's admins", async () => {
          await processCommand(dispatchable)
          expect(addAdminStub.getCall(0).args).to.eql([
            db,
            channel.phoneNumber,
            phoneNumberToAddAsAdmin,
          ])
        })

        describe('when adding the admin succeeds', () => {
          beforeEach(() =>
            addAdminStub.returns(
              Promise.resolve([
                { channelPhoneNumber: channel.phoneNumber, phoneNumberToAddAsAdmin },
              ]),
            ),
          )

          it('returns a SUCCESS status, message, and notifications', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.ADD,
              status: statuses.SUCCESS,
              message: CR.add.success(phoneNumberToAddAsAdmin),
              notifications: [
                // welcome message to newly added admin
                {
                  recipient: phoneNumberToAddAsAdmin,
                  message: messagesIn(languages.EN).notifications.welcome(
                    sender.phoneNumber,
                    channel.phoneNumber,
                  ),
                },
                // notifications for all other bystander admins
                {
                  recipient: channel.memberships[2].memberPhoneNumber,
                  message: messagesIn(channel.memberships[2].language).notifications.adminAdded,
                },
                {
                  recipient: channel.memberships[3].memberPhoneNumber,
                  message: messagesIn(channel.memberships[3].language).notifications.adminAdded,
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
              status: statuses.ERROR,
              message: CR.add.dbError(phoneNumberToAddAsAdmin),
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
            status: statuses.ERROR,
            message: CR.add.invalidNumber('foo'),
          })
        })
      })
    })

    describe('when sender is not a admin', () => {
      const dispatchable = {
        db,
        channel,
        sender: subscriber,
        sdMessage: sdMessageOf(channel, 'ADD me'),
      }
      let result
      beforeEach(async () => (result = await processCommand(dispatchable)))

      it('does not attempt to add admin', () => {
        expect(addAdminStub.callCount).to.eql(0)
      })

      it('returns an UNAUTHORIZED status/message', () => {
        expect(result).to.eql({
          command: commands.ADD,
          status: statuses.UNAUTHORIZED,
          message: CR.add.notAdmin,
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
          status: statuses.SUCCESS,
          message: CR.decline.success,
        })
      })
    })

    describe('when db call fails', () => {
      beforeEach(() => declineStub.callsFake(() => Promise.reject(new Error('boom!'))))

      it('returns an ERROR status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.DECLINE,
          status: statuses.ERROR,
          message: CR.decline.dbError,
        })
      })
    })
  })

  describe('HELP command', () => {
    const sdMessage = sdMessageOf(channel, 'HELP')

    describe('when sender is a admin', () => {
      const dispatchable = { db, channel, sender: admin, sdMessage }

      it('sends a help message to sender', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.HELP,
          status: statuses.SUCCESS,
          message: CR.help.admin,
        })
      })
    })

    describe('when sender is a subscriber', () => {
      const dispatchable = { db, channel, sender: subscriber, sdMessage }

      it('sends a help message to sender', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.HELP,
          status: statuses.SUCCESS,
          message: CR.help.subscriber,
        })
      })
    })

    describe('when sender is a random person', () => {
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }

      it('sends a subscriber help message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.HELP,
          status: statuses.SUCCESS,
          message: CR.help.subscriber,
        })
      })
    })
  })

  describe('INFO command', () => {
    const sdMessage = sdMessageOf(channel, 'INFO')

    describe('when sender is a admin', () => {
      const dispatchable = { db, channel, sender: admin, sdMessage }

      it('sends an info message with more information', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          status: statuses.SUCCESS,
          message: CR.info[memberTypes.ADMIN](channel),
        })
      })
    })

    describe('when sender is a subscriber', () => {
      const dispatchable = { db, channel, sender: subscriber, sdMessage }

      it('sends an info message with less information', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          status: statuses.SUCCESS,
          message: CR.info[memberTypes.SUBSCRIBER](channel),
        })
      })
    })

    describe('when sender is neither admin nor subscriber', () => {
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }

      it('sends a subscriber info message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          status: statuses.SUCCESS,
          message: CR.info[memberTypes.NONE](channel),
        })
      })
    })
  })

  describe('INVITE command', () => {
    const inviteePhoneNumber = genPhoneNumber()
    const sdMessage = sdMessageOf(channel, `INVITE ${inviteePhoneNumber}`)

    let isMemberStub, issueInviteStub
    beforeEach(() => {
      isMemberStub = sinon.stub(membershipRepository, 'isMember')
      issueInviteStub = sinon.stub(inviteRepository, 'issue')
    })
    afterEach(() => {
      isMemberStub.restore()
      issueInviteStub.restore()
    })

    describe('when vouching mode is on', () => {
      const vouchingChannel = { ...channel, vouchingOn: true }

      describe('when sender is not a member of channel', () => {
        const dispatchable = { db, sdMessage, channel: vouchingChannel, sender: randomPerson }

        it('returns UNAUTHORIZED', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.INVITE,
            status: statuses.UNAUTHORIZED,
            message: CR.invite.unauthorized,
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
              status: statuses.ERROR,
              message: CR.invite.invalidNumber('foo'),
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
                status: statuses.ERROR,
                message: CR.invite.success,
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
                  status: statuses.ERROR,
                  message: CR.invite.success,
                })
              })
            })

            describe('when invitee has not already been invited', () => {
              let res
              beforeEach(async () => {
                issueInviteStub.returns(Promise.resolve(true))
                res = await processCommand(dispatchable)
              })

              it('attempts to issue an invite', () => {
                expect(issueInviteStub.callCount).to.eql(1)
              })

              it('returns SUCCESS and payload for notifying invitee', () => {
                expect(res).to.eql({
                  command: commands.INVITE,
                  status: statuses.SUCCESS,
                  message: CR.invite.success,
                  payload: inviteePhoneNumber,
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
          res = await processCommand(dispatchable)
        })

        it('creates an invite record', () => {
          expect(issueInviteStub.callCount).to.eql(1)
        })

        it('returns SUCCESS and payload for notifying invitee', () => {
          expect(res).to.eql({
            command: commands.INVITE,
            status: statuses.SUCCESS,
            message: CR.invite.success,
            payload: inviteePhoneNumber,
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
          status: statuses.SUCCESS,
          message: CR.invite.success,
          payload: inviteePhoneNumber,
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
          status: statuses.ERROR,
          message: CR.join.inviteRequired,
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
              status: statuses.SUCCESS,
              message: CR.join.success(channel),
            })
          })
        })

        describe('when adding subscriber fails', () => {
          beforeEach(() => addSubscriberStub.callsFake(() => Promise.reject('foo')))

          it('returns ERROR status/message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.JOIN,
              status: statuses.ERROR,
              message: CR.join.error,
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
            status: statuses.ERROR,
            message: CR.join.alreadyMember,
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
            status: statuses.ERROR,
            message: CR.join.alreadyMember,
          })
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
            status: statuses.ERROR,
            message: CR.leave.error,
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
          status: statuses.UNAUTHORIZED,
          message: CR.leave.notSubscriber,
        })
      })
    })

    describe('when sender is a admin', () => {
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
          status: statuses.SUCCESS,
          message: CR.leave.success,
          notifications: [
            ...bystanderAdminMemberships.map(membership => ({
              recipient: membership.memberPhoneNumber,
              message: messagesIn(membership.language).notifications.adminLeft,
            })),
          ],
        })
      })
    })
  })

  describe('REMOVE command', () => {
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

    describe('when sender is a admin', () => {
      const sender = admin
      beforeEach(() => removeAdminStub.returns(Promise.resolve()))

      describe('when payload is a valid phone number', () => {
        const removalTargetNumber = channel.memberships[1].memberPhoneNumber
        const rawRemovalTargetNumber = parenthesize(removalTargetNumber)
        const sdMessage = sdMessageOf(channel, `REMOVE ${rawRemovalTargetNumber}`)
        const dispatchable = { db, channel, sender, sdMessage }
        beforeEach(() => validateStub.returns(true))

        describe('when removal target is a admin', () => {
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
                  {
                    recipient: channel.memberships[3].memberPhoneNumber,
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
                status: statuses.ERROR,
                message: CR.remove.dbError(removalTargetNumber),
              })
            })
          })
        })

        describe('when removal target is not a admin', () => {
          beforeEach(() => isAdminStub.returns(Promise.resolve(false)))

          it('does not attempt to remove admin', () => {
            expect(removeAdminStub.callCount).to.eql(0)
          })

          it('returns a SUCCESS status / NOOP message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.REMOVE,
              status: statuses.ERROR,
              message: CR.remove.targetNotAdmin(removalTargetNumber),
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
            status: statuses.ERROR,
            message: CR.remove.invalidNumber('foo'),
          })
        })
      })
    })

    describe('when sender is not a admin', () => {
      const sdMessage = sdMessageOf(channel, `REMOVE ${genPhoneNumber()}`)
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }
      let result

      beforeEach(async () => (result = await processCommand(dispatchable)))

      it('does not attempt to add admin', () => {
        expect(removeAdminStub.callCount).to.eql(0)
      })

      it('returns an SUCCESS status / NOT_NOOP message', () => {
        expect(result).to.eql({
          command: commands.REMOVE,
          status: statuses.UNAUTHORIZED,
          message: CR.remove.notAdmin,
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
            status: statuses.ERROR,
            message: CR.rename.dbError(channel.name, 'foo'),
          })
        })
      })
    })

    describe('when sender is a subscriber', () => {
      const dispatchable = { db, channel, sender: subscriber, sdMessage }

      it('returns UNAUTHORIZED status / message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RENAME,
          status: statuses.UNAUTHORIZED,
          message: CR.rename.notAdmin,
        })
      })
    })

    describe('when sender is a random person', () => {
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }

      it('returns UNAUTHORIZED status / message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RENAME,
          status: statuses.UNAUTHORIZED,
          message: CR.rename.notAdmin,
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
        ...toggles.RESPONSES,
        isOn: true,
        command: commands.RESPONSES_ON,
        commandStr: 'RESPONSES ON',
      },
      {
        ...toggles.RESPONSES,
        isOn: false,
        command: commands.RESPONSES_OFF,
        commandStr: 'RESPONSES OFF',
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
      describe('when sender is a admin', () => {
        const sender = admin

        const sdMessage = sdMessageOf(channel, commandStr)
        const dispatchable = { db, channel, sender, sdMessage }

        it('attempts to update the responsesEnabled field on the channel', async () => {
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
              status: statuses.ERROR,
              message: CR.toggles[name].dbError(isOn),
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
            status: statuses.UNAUTHORIZED,
            message: CR.toggles[name].notAdmin,
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
            status: statuses.UNAUTHORIZED,
            message: CR.toggles[name].notAdmin,
          })
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
        status: statuses.NOOP,
        message: '',
      })
    })
  })
})
