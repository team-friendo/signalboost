import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import {
  commands,
  statuses,
  parseCommand,
  execute,
} from '../../../../app/services/dispatcher/executor'
import { commandResponses as CR } from '../../../../app/services/dispatcher/messages'
import channelRepository from '../../../../app/db/repositories/channel'
import validator from '../../../../app/db/validations'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { administrationFactory } from '../../../support/factories/administration'

describe('executor service', () => {
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

    describe('RENAME command', () => {
      it('parses an RENAME command (regardless of case or whitespace)', () => {
        expect(parseCommand('RENAME')).to.eql({ command: commands.RENAME, payload: '' })
        expect(parseCommand('rename')).to.eql({ command: commands.RENAME, payload: '' })
        expect(parseCommand(' rename ')).to.eql({ command: commands.RENAME, payload: '' })
      })

      it('parses the payload from an RENAME command', () => {
        expect(parseCommand('RENAME foo')).to.eql({ command: commands.RENAME, payload: 'foo' })
      })

      it('does not parse RENAME command if string starts with chars other than `add admin`', () => {
        expect(parseCommand('do RENAME')).to.eql({ command: commands.NOOP })
        expect(parseCommand('lol')).to.eql({ command: commands.NOOP })
      })
    })
  })

  describe('executing commands', () => {
    const db = {}
    const channel = {
      name: 'foobar',
      phoneNumber: '+13333333333',
      administrations: times(2, administrationFactory({ channelPhoneNumber: '+13333333333' })),
      subscriptions: times(2, subscriptionFactory({ channelPhoneNumber: '+13333333333' })),
    }
    const admin = {
      phoneNumber: '+11111111111',
      isAdmin: true,
      isSubscriber: true,
    }
    const subscriber = {
      phoneNumber: '+12222222222',
      isAdmin: false,
      isSubscriber: true,
    }
    const randomPerson = {
      phoneNumber: '+13333333333',
      isAdmin: false,
      isSubscriber: false,
    }

    describe('JOIN command', () => {
      let addSubscriberStub
      beforeEach(() => (addSubscriberStub = sinon.stub(channelRepository, 'addSubscriber')))
      afterEach(() => addSubscriberStub.restore())

      describe('when number is not subscribed to channel', () => {
        describe('when adding subscriber succeeds', () => {
          beforeEach(() => addSubscriberStub.returns(Promise.resolve(subscriptionFactory())))

          it('returns SUCCESS status/message', async () => {
            const dispatchable = { command: commands.JOIN, channel, sender: randomPerson }

            expect(await execute(dispatchable)).to.eql({
              commandResult: {
                command: commands.JOIN,
                status: statuses.SUCCESS,
                message: CR.subscriber.add.success,
              },
              dispatchable,
            })
          })
        })

        describe('when adding subscriber fails', () => {
          beforeEach(() => addSubscriberStub.callsFake(() => Promise.reject('foo')))

          it('returns ERROR status/message', async () => {
            const dispatchable = { command: commands.JOIN, channel, sender: randomPerson }
            expect(await execute(dispatchable)).to.eql({
              commandResult: {
                command: commands.JOIN,
                status: statuses.ERROR,
                message: CR.subscriber.add.error,
              },
              dispatchable,
            })
          })
        })
      })

      describe('when number is subscribed to channel', () => {
        const dispatchable = { command: commands.JOIN, channel, sender: subscriber }
        let result

        beforeEach(async () => (result = await execute(dispatchable)))

        it('does not try to add subscriber', () => {
          expect(addSubscriberStub.callCount).to.eql(0)
        })

        it('returns NOOP status/message', () => {
          expect(result).to.eql({
            commandResult: {
              command: commands.JOIN,
              status: statuses.NOOP,
              message: CR.subscriber.add.noop,
            },
            dispatchable,
          })
        })
      })

      describe('LEAVE command', () => {
        let removeSubscriberStub
        beforeEach(() => (removeSubscriberStub = sinon.stub(channelRepository, 'removeSubscriber')))
        afterEach(() => removeSubscriberStub.restore())

        describe('when sender is subscribed to channel', () => {
          beforeEach(() => removeSubscriberStub.returns(Promise.resolve()))

          it('attempts to remove subscriber', async () => {
            const dispatchable = { command: commands.LEAVE, db, channel, sender: subscriber }
            await execute(dispatchable)
            expect(removeSubscriberStub.getCall(0).args).to.eql([
              db,
              channel.phoneNumber,
              subscriber.phoneNumber,
            ])
          })

          describe('when removing subscriber succeeds', () => {
            beforeEach(() => removeSubscriberStub.returns(Promise.resolve(1)))

            it('returns SUCCESS status/message', async () => {
              const dispatchable = { command: commands.LEAVE, channel, sender: subscriber }
              expect(await execute(dispatchable)).to.eql({
                commandResult: {
                  command: commands.LEAVE,
                  status: statuses.SUCCESS,
                  message: CR.subscriber.remove.success,
                },
                dispatchable,
              })
            })
          })
          describe('when removing subscriber fails', () => {
            beforeEach(() => removeSubscriberStub.callsFake(() => Promise.reject('boom!')))

            it('returns ERROR status/message', async () => {
              const dispatchable = { command: commands.LEAVE, channel, sender: subscriber }
              expect(await execute(dispatchable)).to.eql({
                commandResult: {
                  command: commands.LEAVE,
                  status: statuses.ERROR,
                  message: CR.subscriber.remove.error,
                },
                dispatchable,
              })
            })
          })
        })

        describe('when human is not subscribed to channel', () => {
          const dispatchable = { command: commands.LEAVE, channel, sender: randomPerson }
          let result
          beforeEach(async () => (result = await execute(dispatchable)))

          it('does not try to remove subscriber', () => {
            expect(removeSubscriberStub.callCount).to.eql(0)
          })

          it('returns UNAUTHORIZED status/message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.LEAVE,
                status: statuses.UNAUTHORIZED,
                message: CR.subscriber.remove.unauthorized,
              },
              dispatchable,
            })
          })
        })
      })

      describe('ADD ADMIN command', () => {
        let addAdminStub
        beforeEach(() => (addAdminStub = sinon.stub(channelRepository, 'addAdmin')))
        afterEach(() => addAdminStub.restore())

        describe('when sender is an admin', () => {
          const sender = admin

          describe('when payload is a valid phone number', () => {
            const payload = genPhoneNumber()
            beforeEach(() => addAdminStub.returns(Promise.resolve()))

            it("attempts to add the human to the chanel's admins", async () => {
              await execute({ command: commands.ADD_ADMIN, payload, db, channel, sender })
              expect(addAdminStub.getCall(0).args).to.eql([db, channel.phoneNumber, payload])
            })

            describe('when adding the admin succeeds', () => {
              beforeEach(() =>
                addAdminStub.returns(
                  Promise.resolve([
                    { channelPhoneNumber: channel.phoneNumber, humanPhoneNumber: payload },
                  ]),
                ),
              )

              it('returns a SUCCESS status and message', async () => {
                const dispatchable = { command: commands.ADD_ADMIN, payload, db, channel, sender }
                expect(await execute(dispatchable)).to.eql({
                  commandResult: {
                    command: commands.ADD_ADMIN,
                    status: statuses.SUCCESS,
                    message: CR.admin.add.success(payload),
                  },
                  dispatchable,
                })
              })
            })

            describe('when adding the admin fails', () => {
              beforeEach(() => addAdminStub.callsFake(() => Promise.reject('oh noes!')))

              it('returns an ERROR status and message', async () => {
                const dispatchable = { command: commands.ADD_ADMIN, payload, db, channel, sender }
                expect(await execute(dispatchable)).to.eql({
                  commandResult: {
                    command: commands.ADD_ADMIN,
                    status: statuses.ERROR,
                    message: CR.admin.add.dbError(payload),
                  },
                  dispatchable,
                })
              })
            })
          })

          describe('when payload is not a valid phone number', async () => {
            const dispatchable = { command: commands.ADD_ADMIN, payload: 'foo', channel, sender }
            let result
            beforeEach(async () => (result = await execute(dispatchable)))

            it('does not attempt to add admin', () => {
              expect(addAdminStub.callCount).to.eql(0)
            })

            it('returns a ERROR status/message', () => {
              expect(result).to.eql({
                commandResult: {
                  command: commands.ADD_ADMIN,
                  status: statuses.ERROR,
                  message: CR.admin.add.invalidNumber('foo'),
                },
                dispatchable,
              })
            })
          })
        })

        describe('when sender is not an admin', () => {
          const dispatchable = {
            command: commands.ADD_ADMIN,
            payload: 'foo',
            channel,
            sender: subscriber,
          }
          let result
          beforeEach(async () => (result = await execute(dispatchable)))

          it('does not attempt to add admin', () => {
            expect(addAdminStub.callCount).to.eql(0)
          })

          it('returns an UNAUTHORIZED status/message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.ADD_ADMIN,
                status: statuses.UNAUTHORIZED,
                message: CR.admin.add.unauthorized,
              },
              dispatchable,
            })
          })
        })
      })

      describe('REMOVE ADMIN command', () => {
        let validateStub, isAdminStub, removeAdminStub

        beforeEach(() => {
          validateStub = sinon.stub(validator, 'validatePhoneNumber')
          isAdminStub = sinon.stub(channelRepository, 'isAdmin')
          removeAdminStub = sinon.stub(channelRepository, 'removeAdmin')
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
            const payload = genPhoneNumber()
            beforeEach(() => validateStub.returns(true))

            describe('when removal target is an admin', () => {
              beforeEach(() => isAdminStub.returns(Promise.resolve(true)))

              it("attempts to remove the human from the chanel's admins", async () => {
                await execute({ command: commands.REMOVE_ADMIN, payload, db, channel, sender })
                expect(removeAdminStub.getCall(0).args).to.eql([db, channel.phoneNumber, payload])
              })

              describe('when removing the admin succeeds', () => {
                beforeEach(() => removeAdminStub.returns(Promise.resolve([1, 1])))

                it('returns a SUCCESS status and message', async () => {
                  const dispatchable = { command: commands.REMOVE_ADMIN, payload, channel, sender }
                  expect(await execute(dispatchable)).to.eql({
                    commandResult: {
                      command: commands.REMOVE_ADMIN,
                      status: statuses.SUCCESS,
                      message: CR.admin.remove.success(payload),
                    },
                    dispatchable,
                  })
                })
              })

              describe('when removing the admin fails', () => {
                beforeEach(() => removeAdminStub.callsFake(() => Promise.reject('oh noes!')))

                it('returns an ERROR status/message', async () => {
                  const dispatchable = { command: commands.REMOVE_ADMIN, payload, channel, sender }
                  expect(await execute(dispatchable)).to.eql({
                    commandResult: {
                      command: commands.REMOVE_ADMIN,
                      status: statuses.ERROR,
                      message: CR.admin.remove.dbError(payload),
                    },
                    dispatchable,
                  })
                })
              })
            })

            describe('when removal target is not an admin', () => {
              beforeEach(() => isAdminStub.returns(Promise.resolve(false)))

              it('does not attempt to remove admin', () => {
                expect(removeAdminStub.callCount).to.eql(0)
              })

              it('returns a SUCCESS status / NOOP message', async () => {
                const dispatchable = { command: commands.REMOVE_ADMIN, payload, channel, sender }
                expect(await execute(dispatchable)).to.eql({
                  commandResult: {
                    command: commands.REMOVE_ADMIN,
                    status: statuses.ERROR,
                    message: CR.admin.remove.targetNotAdmin(payload),
                  },
                  dispatchable,
                })
              })
            })
          })

          describe('when payload is not a valid phone number', async () => {
            const dispatchable = { command: commands.REMOVE_ADMIN, payload: 'foo', channel, sender }
            let result
            beforeEach(async () => (result = await execute(dispatchable)))

            it('does not attempt to remove admin', () => {
              expect(removeAdminStub.callCount).to.eql(0)
            })

            it('returns a SUCCESS status / NOOP message', () => {
              expect(result).to.eql({
                commandResult: {
                  command: commands.REMOVE_ADMIN,
                  status: statuses.ERROR,
                  message: CR.admin.remove.invalidNumber('foo'),
                },
                dispatchable,
              })
            })
          })
        })

        describe('when sender is not an admin', () => {
          const sender = randomPerson
          const dispatchable = { command: commands.REMOVE_ADMIN, payload: 'foo', channel, sender }
          let result

          beforeEach(async () => (result = await execute(dispatchable)))

          it('does not attempt to add admin', () => {
            expect(removeAdminStub.callCount).to.eql(0)
          })

          it('returns an SUCCESS status / NOT_ADMIN_NOOP message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.REMOVE_ADMIN,
                status: statuses.UNAUTHORIZED,
                message: CR.admin.remove.unauthorized,
              },
              dispatchable,
            })
          })
        })
      })

      describe('INFO command', () => {
        describe('when sender is an admin', () => {
          const sender = admin
          it('sends an info message with more information', async () => {
            const dispatchable = { command: commands.INFO, db, channel, sender }
            expect(await execute(dispatchable)).to.eql({
              commandResult: {
                command: commands.INFO,
                status: statuses.SUCCESS,
                message: CR.info.admin(channel),
              },
              dispatchable,
            })
          })
        })

        describe('when sender is a subscriber', () => {
          const sender = subscriber
          it('sends an info message with less information', async () => {
            const dispatchable = { command: commands.INFO, db, channel, sender }
            expect(await execute(dispatchable)).to.eql({
              commandResult: {
                command: commands.INFO,
                status: statuses.SUCCESS,
                message: CR.info.subscriber(channel),
              },
              dispatchable,
            })
          })
        })

        describe('when sender is neither admin nor subscriber', () => {
          const sender = randomPerson
          it('sends an UNAUTHORIZED message', async () => {
            const dispatchable = { command: commands.INFO, db, channel, sender }
            expect(await execute(dispatchable)).to.eql({
              commandResult: {
                command: commands.INFO,
                status: statuses.UNAUTHORIZED,
                message: CR.info.unauthorized,
              },
              dispatchable,
            })
          })
        })
      })

      describe('invalid command', () => {
        it('returns NOOP status/message', async () => {
          const dispatchable = { command: 'foobar' }
          expect(await execute(dispatchable)).to.eql({
            commandResult: {
              command: 'foobar',
              status: statuses.NOOP,
              message: CR.noop,
            },
            dispatchable,
          })
        })
      })
    })
  })
})
