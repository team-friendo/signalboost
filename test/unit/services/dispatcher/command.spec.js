import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import {
  commands,
  statuses,
  messages,
  parseCommand,
  execute,
} from '../../../../app/services/dispatcher/command'
import channelRepository from '../../../../app/db/repositories/channel'
import validator from '../../../../app/db/validations'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { administrationFactory } from '../../../support/factories/administration'

describe('command service', () => {
  before(() => (process.env.CHANNEL_NAME = 'test channel'))
  after(() => (process.env.CHANNEL_NAME = undefined))

  describe('parsing commands', () => {
    describe('ADD ADMIN command', () => {
      it('parses an ADD ADMIN command (regardless of case or whitespace)', () => {
        expect(parseCommand('ADD ADMIN')).to.eql({ command: commands.ADD_ADMIN, payload: '' })
        expect(parseCommand('add admin')).to.eql({ command: commands.ADD_ADMIN, payload: '' })
        expect(parseCommand(' add admin ')).to.eql({ command: commands.ADD_ADMIN, payload: '' })
        expect(parseCommand('ADDADMIN')).to.eql({ command: commands.ADD_ADMIN, payload: '' })
        expect(parseCommand('addadmin')).to.eql({ command: commands.ADD_ADMIN, payload: '' })
      })

      it('parses the payload from an ADD ADMIN command', () => {
        expect(parseCommand('ADD ADMIN foo')).to.eql({
          command: commands.ADD_ADMIN,
          payload: 'foo',
        })
      })

      it('does not parse ADD ADMIN command if string starts with chars other than `add admin`', () => {
        expect(parseCommand('do ADD ADMIN')).to.eql({ command: commands.NOOP })
        expect(parseCommand('lol')).to.eql({ command: commands.NOOP })
      })
    })

    describe('REMOVE ADMIN command', () => {
      it('parses an REMOVE ADMIN command (regardless of case or whitespace)', () => {
        expect(parseCommand('REMOVE ADMIN')).to.eql({ command: commands.REMOVE_ADMIN, payload: '' })
        expect(parseCommand('remove admin')).to.eql({ command: commands.REMOVE_ADMIN, payload: '' })
        expect(parseCommand(' remove admin ')).to.eql({
          command: commands.REMOVE_ADMIN,
          payload: '',
        })
        expect(parseCommand('REMOVEADMIN')).to.eql({ command: commands.REMOVE_ADMIN, payload: '' })
        expect(parseCommand('removeadmin')).to.eql({ command: commands.REMOVE_ADMIN, payload: '' })
      })

      it('parses the payload from an REMOVE ADMIN command', () => {
        expect(parseCommand('REMOVE ADMIN foo')).to.eql({
          command: commands.REMOVE_ADMIN,
          payload: 'foo',
        })
      })

      it('does not parse REMOVE ADMIN command if string starts with chars other than `add admin`', () => {
        expect(parseCommand('do REMOVE ADMIN')).to.eql({ command: commands.NOOP })
        expect(parseCommand('lol')).to.eql({ command: commands.NOOP })
      })
    })

    describe('INFO command', () => {
      it('parses an INFO command (regardless of case or whitespace)', () => {
        expect(parseCommand('INFO')).to.eql({ command: commands.INFO })
        expect(parseCommand('info')).to.eql({ command: commands.INFO })
        expect(parseCommand(' info ')).to.eql({ command: commands.INFO })
      })

      it('does not parse an INFO command when string contains characters other than `info`', () => {
        expect(parseCommand('i want info ')).to.eql({ command: commands.NOOP })
        expect(parseCommand('info me!')).to.eql({ command: commands.NOOP })
        expect(parseCommand('foobar')).to.eql({ command: commands.NOOP })
      })
    })

    describe('JOIN command', () => {
      it('parses an JOIN command (regardless of case or whitespace)', () => {
        expect(parseCommand('JOIN')).to.eql({ command: commands.JOIN })
        expect(parseCommand('join')).to.eql({ command: commands.JOIN })
        expect(parseCommand(' join ')).to.eql({ command: commands.JOIN })
      })

      it('does not parse an JOIN command when string contains characters other than `join`', () => {
        expect(parseCommand('i wanna join ')).to.eql({ command: commands.NOOP })
        expect(parseCommand('join it!')).to.eql({ command: commands.NOOP })
        expect(parseCommand('foobar')).to.eql({ command: commands.NOOP })
      })
    })

    describe('LEAVE command', () => {
      it('parses a LEAVE command regardless of case or whitespace', () => {
        expect(parseCommand('LEAVE')).to.eql({ command: commands.LEAVE })
        expect(parseCommand('leave')).to.eql({ command: commands.LEAVE })
        expect(parseCommand(' leave ')).to.eql({ command: commands.LEAVE })
      })

      it('does not parse a LEAVE command when string contains characters other than `leave`', () => {
        expect(parseCommand('i wanna leave ')).to.eql({ command: commands.NOOP })
        expect(parseCommand('leave now!')).to.eql({ command: commands.NOOP })
        expect(parseCommand('foobar')).to.eql({ command: commands.NOOP })
      })
    })
  })

  describe('executing commands', () => {
    describe('JOIN command', () => {
      const command = commands.JOIN
      let isSubscriberStub, addSubscriberStub

      beforeEach(() => {
        isSubscriberStub = sinon.stub(channelRepository, 'isSubscriber')
        addSubscriberStub = sinon.stub(channelRepository, 'addSubscriber')
      })

      afterEach(() => {
        isSubscriberStub.restore()
        addSubscriberStub.restore()
      })

      describe('when number is not subscribed to channel', () => {
        beforeEach(() => {
          isSubscriberStub.returns(Promise.resolve(false))
        })

        describe('when adding subscriber succeeds', () => {
          beforeEach(() => {
            addSubscriberStub.returns(Promise.resolve(subscriptionFactory()))
          })

          it('returns SUCCESS status/message', async () => {
            expect(await execute({ command })).to.eql({
              status: statuses.SUCCESS,
              message: messages.JOIN_SUCCESS,
            })
          })
        })

        describe('when adding subscriber fails', () => {
          beforeEach(() => {
            addSubscriberStub.callsFake(() => Promise.reject('foo'))
          })

          it('returns FAILURE status/message', async () => {
            expect(await execute({ command })).to.eql({
              status: statuses.FAILURE,
              message: messages.JOIN_FAILURE,
            })
          })
        })
      })

      describe('when number is subscribed to channel', () => {
        let result
        beforeEach(async () => {
          isSubscriberStub.returns(Promise.resolve(true))
          result = await execute({ command })
        })
        it('does not try to add subscriber', () => {
          expect(addSubscriberStub.callCount).to.eql(0)
        })
        it('returns SUCCESS status / NOOP message', () => {
          expect(result).to.eql({
            status: statuses.SUCCESS,
            message: messages.JOIN_NOOP,
          })
        })
      })
    })

    describe('LEAVE command', () => {
      const command = commands.LEAVE
      const db = {}
      const [channelPhoneNumber, sender] = times(2, genPhoneNumber)
      let isSubscriberStub, removeSubscriberStub

      beforeEach(() => {
        isSubscriberStub = sinon.stub(channelRepository, 'isSubscriber')
        removeSubscriberStub = sinon.stub(channelRepository, 'removeSubscriber')
      })

      afterEach(() => {
        isSubscriberStub.restore()
        removeSubscriberStub.restore()
      })

      describe('in all cases', () => {
        it('checks to see if sender is subscribed to channel', async () => {
          await execute({ command, db, channelPhoneNumber, sender })
          expect(isSubscriberStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        })
      })

      describe('when sender is subscribed to channel', () => {
        beforeEach(() => {
          isSubscriberStub.returns(Promise.resolve(true))
          removeSubscriberStub.returns(Promise.resolve())
        })

        it('attempts to remove subscriber', async () => {
          await execute({ command, db, channelPhoneNumber, sender })
          expect(removeSubscriberStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        })

        describe('when removing subscriber succeeds', () => {
          beforeEach(() => removeSubscriberStub.returns(Promise.resolve(1)))

          it('returns SUCCESS status/message', async () => {
            expect(await execute({ command })).to.eql({
              status: statuses.SUCCESS,
              message: messages.LEAVE_SUCCESS,
            })
          })
        })
        describe('when removing subscriber fails', () => {
          beforeEach(() => removeSubscriberStub.callsFake(() => Promise.reject('boom!')))

          it('returns FAILURE status/message', async () => {
            expect(await execute({ command })).to.eql({
              status: statuses.FAILURE,
              message: messages.LEAVE_FAILURE,
            })
          })
        })
      })

      describe('when human is not subscribed to channel', () => {
        let result
        beforeEach(async () => {
          isSubscriberStub.returns(Promise.resolve(false))
          result = await execute({ command })
        })

        it('does not try to remove subscriber', () => {
          expect(removeSubscriberStub.callCount).to.eql(0)
        })

        it('returns SUCCESS status / NOOP message', () => {
          expect(result).to.eql({
            status: statuses.SUCCESS,
            message: messages.LEAVE_NOOP,
          })
        })
      })
    })

    describe('ADD ADMIN command', () => {
      const command = commands.ADD_ADMIN
      const db = {}
      const [channelPhoneNumber, sender, newAdmin] = times(4, genPhoneNumber)
      let isAdminStub, addAdminStub

      beforeEach(() => {
        isAdminStub = sinon.stub(channelRepository, 'isAdmin')
        addAdminStub = sinon.stub(channelRepository, 'addAdmin')
      })

      afterEach(() => {
        isAdminStub.restore()
        addAdminStub.restore()
      })

      describe('in all cases', () => {
        it('checks to see if sender is an admin', async () => {
          await execute({ command, payload: newAdmin, db, channelPhoneNumber, sender })
          expect(isAdminStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        })
      })

      describe('when sender is an admin', () => {
        beforeEach(() => {
          isAdminStub.returns(Promise.resolve(true))
          addAdminStub.returns(Promise.resolve())
        })

        describe('when payload is a valid phone number', () => {
          it("attempts to add the human to the chanel's admins", async () => {
            await execute({ command, payload: newAdmin, db, channelPhoneNumber, sender })
            expect(addAdminStub.getCall(0).args).to.eql([db, channelPhoneNumber, newAdmin])
          })

          describe('when adding the admin succeeds', () => {
            beforeEach(() =>
              addAdminStub.returns(
                Promise.resolve([{ channelPhoneNumber, humanPhoneNumber: newAdmin }]),
              ),
            )

            it('returns a SUCCESS status and message', async () => {
              expect(await execute({ command: commands.ADD_ADMIN, payload: newAdmin })).to.eql({
                status: statuses.SUCCESS,
                message: messages.ADD_ADMIN_SUCCESS(newAdmin),
              })
            })
          })

          describe('when adding the admin fails', () => {
            beforeEach(() => addAdminStub.callsFake(() => Promise.reject('oh noes!')))

            it('returns an FAILURE status and message', async () => {
              expect(await execute({ command: commands.ADD_ADMIN, payload: newAdmin })).to.eql({
                status: statuses.FAILURE,
                message: messages.ADD_ADMIN_FAILURE(newAdmin),
              })
            })
          })
        })

        describe('when payload is not a valid phone number', async () => {
          let result
          beforeEach(
            async () =>
              (result = await execute({ command: commands.ADD_ADMIN, payload: 'foobar' })),
          )

          it('does not attempt to add admin', () => {
            expect(addAdminStub.callCount).to.eql(0)
          })

          it('returns a SUCCESS status / INVALID_NUMBER message', () => {
            expect(result).to.eql({
              status: statuses.SUCCESS,
              message: messages.ADD_ADMIN_NOOP_INVALID_NUMBER('foobar'),
            })
          })
        })
      })

      describe('when sender is not an admin', () => {
        let result
        beforeEach(async () => {
          isAdminStub.returns(Promise.resolve(false))
          result = await execute({ command: commands.ADD_ADMIN, payload: '' })
        })

        it('does not attempt to add admin', () => {
          expect(addAdminStub.callCount).to.eql(0)
        })

        it('returns an SUCCESS status / NOT_ADMIN_NOOP message', () => {
          expect(result).to.eql({
            status: statuses.SUCCESS,
            message: messages.ADD_ADMIN_NOOP_NOT_ADMIN,
          })
        })
      })
    })

    describe('REMOVE ADMIN command', () => {
      const command = commands.REMOVE_ADMIN
      const db = {}
      const [channelPhoneNumber, sender, newAdmin] = times(4, genPhoneNumber)
      let isAdminStub, validateStub, removeAdminStub

      beforeEach(() => {
        isAdminStub = sinon.stub(channelRepository, 'isAdmin')
        validateStub = sinon.stub(validator, 'validatePhoneNumber')
        removeAdminStub = sinon.stub(channelRepository, 'removeAdmin')
      })

      afterEach(() => {
        isAdminStub.restore()
        validateStub.restore()
        removeAdminStub.restore()
      })

      describe('in all cases', () => {
        beforeEach(async () => {
          isAdminStub.returns(Promise.resolve())
          validateStub.returns(null)
          removeAdminStub.returns(Promise.resolve())

          await execute({ command, payload: newAdmin, db, channelPhoneNumber, sender })
        })

        it('checks to see if sender is an admin', async () => {
          expect(isAdminStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        })

        it('it validates removal target phone number', () => {
          expect(validateStub.getCall(0).args).to.eql([newAdmin])
        })

        it('checks to see if removal target is an admin', () => {
          expect(isAdminStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        })
      })

      describe('when sender is an admin', () => {
        beforeEach(() => {
          isAdminStub.onCall(0).returns(Promise.resolve(true))
          removeAdminStub.returns(Promise.resolve())
        })

        describe('when payload is a valid phone number', () => {
          beforeEach(() => validateStub.returns(true))

          describe('when removal target is an admin', () => {
            beforeEach(() => isAdminStub.onCall(1).returns(Promise.resolve(true)))

            it("attempts to remove the human from the chanel's admins", async () => {
              await execute({ command, payload: newAdmin, db, channelPhoneNumber, sender })
              expect(removeAdminStub.getCall(0).args).to.eql([db, channelPhoneNumber, newAdmin])
            })

            describe('when removing the admin succeeds', () => {
              beforeEach(() => removeAdminStub.returns(Promise.resolve([1, 1])))

              it('returns a SUCCESS status and message', async () => {
                expect(await execute({ command: commands.REMOVE_ADMIN, payload: newAdmin })).to.eql(
                  {
                    status: statuses.SUCCESS,
                    message: messages.REMOVE_ADMIN_SUCCESS(newAdmin),
                  },
                )
              })
            })

            describe('when removing the admin fails', () => {
              beforeEach(() => removeAdminStub.callsFake(() => Promise.reject('oh noes!')))

              it('returns an FAILURE status and message', async () => {
                expect(await execute({ command: commands.REMOVE_ADMIN, payload: newAdmin })).to.eql(
                  {
                    status: statuses.FAILURE,
                    message: messages.REMOVE_ADMIN_FAILURE(newAdmin),
                  },
                )
              })
            })
          })

          describe('when removal target is not an admin', () => {
            beforeEach(() => isAdminStub.onCall(1).returns(Promise.resolve(false)))

            it('does not attempt to remove admin', () => {
              expect(removeAdminStub.callCount).to.eql(0)
            })

            it('returns a SUCCESS status / NOOP message', async () => {
              expect(await execute({ command: commands.REMOVE_ADMIN, payload: newAdmin })).to.eql({
                status: statuses.SUCCESS,
                message: messages.REMOVE_ADMIN_NOOP_TARGET_NOT_ADMIN(newAdmin),
              })
            })
          })
        })

        describe('when payload is not a valid phone number', async () => {
          let result
          beforeEach(async () => {
            validateStub.returns(false)
            result = await execute({ command: commands.REMOVE_ADMIN, payload: 'foobar' })
          })

          it('does not attempt to remove admin', () => {
            expect(removeAdminStub.callCount).to.eql(0)
          })

          it('returns a SUCCESS status / NOOP message', () => {
            expect(result).to.eql({
              status: statuses.SUCCESS,
              message: messages.REMOVE_ADMIN_NOOP_INVALID_NUMBER('foobar'),
            })
          })
        })
      })

      describe('when sender is not an admin', () => {
        let result
        beforeEach(async () => {
          isAdminStub.returns(Promise.resolve(false))
          result = await execute({ command: commands.REMOVE_ADMIN, payload: '' })
        })

        it('does not attempt to add admin', () => {
          expect(removeAdminStub.callCount).to.eql(0)
        })

        it('returns an SUCCESS status / NOT_ADMIN_NOOP message', () => {
          expect(result).to.eql({
            status: statuses.SUCCESS,
            message: messages.REMOVE_ADMIN_NOOP_SENDER_NOT_ADMIN,
          })
        })
      })
    })

    describe('INFO command', () => {
      const command = commands.INFO
      const [channelPhoneNumber, sender] = times(2, genPhoneNumber)
      const administrations = times(2, administrationFactory())
      const subscriptions = times(4, subscriptionFactory())
      const db = {
        administration: { findAll: () => Promise.resolve(administrations) },
        subscription: { findAll: () => Promise.resolve(subscriptions) },
      }
      let isAdminStub, isSubscriberStub

      beforeEach(() => {
        isAdminStub = sinon.stub(channelRepository, 'isAdmin')
        isSubscriberStub = sinon.stub(channelRepository, 'isSubscriber')
      })

      afterEach(() => {
        isAdminStub.restore()
        isSubscriberStub.restore()
      })

      describe('in all cases', () => {
        beforeEach(() => {
          isAdminStub.returns(Promise.resolve())
          isSubscriberStub.returns(Promise.resolve())
        })

        it('checks to see if sender is admin of channel', async () => {
          await execute({ command, db, channelPhoneNumber, sender })
          expect(isAdminStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        })

        it('checks to see if sender is subscribed to channel', async () => {
          await execute({ command, db, channelPhoneNumber, sender })
          expect(isSubscriberStub.getCall(0).args).to.eql([db, channelPhoneNumber, sender])
        })
      })

      describe('when sender is an admin', () => {
        beforeEach(() => {
          isAdminStub.returns(Promise.resolve(true))
          isSubscriberStub.returns(Promise.resolve(true))
        })

        it('sends an info message with more information', async () => {
          expect(await execute({ command, db, channelPhoneNumber, sender })).to.eql({
            status: statuses.SUCCESS,
            message: messages.INFO(
              channelPhoneNumber,
              administrations.map(a => a.humanPhoneNumber),
              4,
            ),
          })
        })
      })

      describe('when sender is a subscriber', () => {
        beforeEach(() => {
          isAdminStub.returns(Promise.resolve(false))
          isSubscriberStub.returns(Promise.resolve(true))
        })

        it('sends an info message with less information', async () => {
          expect(await execute({ command, db, channelPhoneNumber, sender })).to.eql({
            status: statuses.SUCCESS,
            message: messages.INFO(channelPhoneNumber, 2, 4),
          })
        })
      })

      describe('when sender is neither admin nor subscriber', () => {
        beforeEach(() => {
          isAdminStub.returns(Promise.resolve(false))
          isSubscriberStub.returns(Promise.resolve(false))
        })

        it('sends an error message', async () => {
          expect(await execute({ command, db, channelPhoneNumber, sender })).to.eql({
            status: statuses.SUCCESS,
            message: messages.INFO_NOOP,
          })
        })
      })
    })

    describe('invalid command', () => {
      it('returns NOOP status/message', async () => {
        expect(await execute({ command: 'foobar' })).to.eql({
          status: statuses.NOOP,
          message: messages.INVALID,
        })
      })
    })
  })
})
