import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
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
import { publicationFactory } from '../../../support/factories/publication'

describe('executor service', () => {
  describe('parsing commands', () => {
    describe('ADD PUBLISHER command', () => {
      it('parses an ADD PUBLISHER command (regardless of case or whitespace)', () => {
        expect(parseCommand('ADD')).to.eql({ command: commands.ADD, payload: '' })
        expect(parseCommand('add')).to.eql({ command: commands.ADD, payload: '' })
        expect(parseCommand(' add ')).to.eql({ command: commands.ADD, payload: '' })
      })

      it('parses the payload from an ADD PUBLISHER command', () => {
        expect(parseCommand('ADD foo')).to.eql({ command: commands.ADD, payload: 'foo' })
      })

      it('does not parse ADD PUBLISHER command if string starts with chars other than `add publisher`', () => {
        expect(parseCommand('do ADD')).to.eql({ command: commands.NOOP })
        expect(parseCommand('lol')).to.eql({ command: commands.NOOP })
      })
    })

    describe('HELP command', () => {
      it('parses an HELP command (regardless of case or whitespace)', () => {
        expect(parseCommand('HELP')).to.eql({ command: commands.HELP })
        expect(parseCommand('help')).to.eql({ command: commands.HELP })
        expect(parseCommand(' help ')).to.eql({ command: commands.HELP })
      })

      it('does not parse a HELP command when string contains characters other than `info`', () => {
        expect(parseCommand('i want help ')).to.eql({ command: commands.NOOP })
        expect(parseCommand('help me!')).to.eql({ command: commands.NOOP })
        expect(parseCommand('foobar')).to.eql({ command: commands.NOOP })
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

    describe('REMOVE PUBLISHER command', () => {
      it('parses an REMOVE PUBLISHER command (regardless of case or whitespace)', () => {
        expect(parseCommand('REMOVE')).to.eql({ command: commands.REMOVE, payload: '' })
        expect(parseCommand('remove')).to.eql({ command: commands.REMOVE, payload: '' })
        expect(parseCommand(' remove ')).to.eql({ command: commands.REMOVE, payload: '' })
      })

      it('parses the payload from an REMOVE PUBLISHER command', () => {
        expect(parseCommand('REMOVE foo')).to.eql({ command: commands.REMOVE, payload: 'foo' })
      })

      it('does not parse REMOVE PUBLISHER command if string starts with chars other than `add publisher`', () => {
        expect(parseCommand('do REMOVE foo')).to.eql({ command: commands.NOOP })
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

      it('does not parse RENAME command if string starts with chars other than `add publisher`', () => {
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
      publications: times(2, publicationFactory({ channelPhoneNumber: '+13333333333' })),
      subscriptions: times(2, subscriptionFactory({ channelPhoneNumber: '+13333333333' })),
      messageCount: { broadcastIn: 42 },
    }
    const publisher = {
      phoneNumber: '+11111111111',
      isPublisher: true,
      isSubscriber: false,
    }
    const subscriber = {
      phoneNumber: '+12222222222',
      isPublisher: false,
      isSubscriber: true,
    }
    const randomPerson = {
      phoneNumber: '+13333333333',
      isPublisher: false,
      isSubscriber: false,
    }

    describe('ADD command', () => {
      let addPublisherStub
      beforeEach(() => (addPublisherStub = sinon.stub(channelRepository, 'addPublisher')))
      afterEach(() => addPublisherStub.restore())

      describe('when sender is a publisher', () => {
        const sender = publisher

        describe('when payload is a valid phone number', () => {
          const payload = genPhoneNumber()
          beforeEach(() => addPublisherStub.returns(Promise.resolve()))

          it("attempts to add payload number to the chanel's publishers", async () => {
            await execute({ command: commands.ADD, payload, db, channel, sender })
            expect(addPublisherStub.getCall(0).args).to.eql([db, channel.phoneNumber, payload])
          })

          describe('when adding the publisher succeeds', () => {
            beforeEach(() =>
              addPublisherStub.returns(
                Promise.resolve([
                  { channelPhoneNumber: channel.phoneNumber, publisherPhoneNumber: payload },
                ]),
              ),
            )

            it('returns a SUCCESS status / message and publisher number as payload', async () => {
              const dispatchable = { command: commands.ADD, payload, db, channel, sender }
              expect(await execute(dispatchable)).to.eql({
                commandResult: {
                  command: commands.ADD,
                  status: statuses.SUCCESS,
                  messageBody: CR.publisher.add.success(payload),
                  payload,
                },
                dispatchable,
              })
            })
          })

          describe('when adding the publisher fails', () => {
            beforeEach(() => addPublisherStub.callsFake(() => Promise.reject('oh noes!')))

            it('returns an ERROR status and message', async () => {
              const dispatchable = { command: commands.ADD, payload, db, channel, sender }
              expect(await execute(dispatchable)).to.eql({
                commandResult: {
                  command: commands.ADD,
                  status: statuses.ERROR,
                  messageBody: CR.publisher.add.dbError(payload),
                },
                dispatchable,
              })
            })
          })
        })

        describe('when payload is not a valid phone number', async () => {
          const dispatchable = { command: commands.ADD, payload: 'foo', channel, sender }
          let result
          beforeEach(async () => (result = await execute(dispatchable)))

          it('does not attempt to add publisher', () => {
            expect(addPublisherStub.callCount).to.eql(0)
          })

          it('returns a ERROR status/message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.ADD,
                status: statuses.ERROR,
                messageBody: CR.publisher.add.invalidNumber('foo'),
              },
              dispatchable,
            })
          })
        })
      })

      describe('when sender is not a publisher', () => {
        const dispatchable = {
          command: commands.ADD,
          payload: 'foo',
          channel,
          sender: subscriber,
        }
        let result
        beforeEach(async () => (result = await execute(dispatchable)))

        it('does not attempt to add publisher', () => {
          expect(addPublisherStub.callCount).to.eql(0)
        })

        it('returns an UNAUTHORIZED status/message', () => {
          expect(result).to.eql({
            commandResult: {
              command: commands.ADD,
              status: statuses.UNAUTHORIZED,
              messageBody: CR.publisher.add.unauthorized,
            },
            dispatchable,
          })
        })
      })
    })

    describe('HELP command', () => {
      describe('when sender is a publisher', () => {
        const sender = publisher
        it('sends a help message to sender', async () => {
          const dispatchable = { command: commands.HELP, db, channel, sender }
          expect(await execute(dispatchable)).to.eql({
            commandResult: {
              command: commands.HELP,
              status: statuses.SUCCESS,
              messageBody: CR.help.publisher,
            },
            dispatchable,
          })
        })
      })

      describe('when sender is a subscriber', () => {
        const sender = subscriber
        it('sends a help message to sender', async () => {
          const dispatchable = { command: commands.HELP, db, channel, sender }
          expect(await execute(dispatchable)).to.eql({
            commandResult: {
              command: commands.HELP,
              status: statuses.SUCCESS,
              messageBody: CR.help.subscriber,
            },
            dispatchable,
          })
        })
      })

      describe('when sender is a random person', () => {
        const sender = randomPerson
        it('sends an UNAUTHORIZED message', async () => {
          const dispatchable = { command: commands.HELP, db, channel, sender }
          expect(await execute(dispatchable)).to.eql({
            commandResult: {
              command: commands.HELP,
              status: statuses.UNAUTHORIZED,
              messageBody: CR.help.unauthorized,
            },
            dispatchable,
          })
        })
      })
    })

    describe('INFO command', () => {
      describe('when sender is a publisher', () => {
        const sender = publisher
        it('sends an info message with more information', async () => {
          const dispatchable = { command: commands.INFO, db, channel, sender }
          expect(await execute(dispatchable)).to.eql({
            commandResult: {
              command: commands.INFO,
              status: statuses.SUCCESS,
              messageBody: CR.info.publisher(channel),
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
              messageBody: CR.info.subscriber(channel),
            },
            dispatchable,
          })
        })
      })

      describe('when sender is neither publisher nor subscriber', () => {
        const sender = randomPerson
        it('sends an UNAUTHORIZED message', async () => {
          const dispatchable = { command: commands.INFO, db, channel, sender }
          expect(await execute(dispatchable)).to.eql({
            commandResult: {
              command: commands.INFO,
              status: statuses.UNAUTHORIZED,
              messageBody: CR.info.unauthorized,
            },
            dispatchable,
          })
        })
      })
    })

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
                messageBody: CR.subscriber.add.success(channel),
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
                messageBody: CR.subscriber.add.error,
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
              messageBody: CR.subscriber.add.noop,
            },
            dispatchable,
          })
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
                messageBody: CR.subscriber.remove.success,
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
                messageBody: CR.subscriber.remove.error,
              },
              dispatchable,
            })
          })
        })
      })

      describe('when sender is not subscribed to channel', () => {
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
              messageBody: CR.subscriber.remove.unauthorized,
            },
            dispatchable,
          })
        })
      })

      describe('when sender is a publisher', () => {
        let result, removePublisherStub
        const dispatchable = { command: commands.LEAVE, db, channel, sender: publisher }

        beforeEach(async () => {
          removePublisherStub = sinon
            .stub(channelRepository, 'removePublisher')
            .returns(Promise.resolve([1, 1]))
          result = await execute(dispatchable)
        })
        afterEach(() => removePublisherStub.restore())

        it('removes sender as publisher of channel', () => {
          expect(removePublisherStub.getCall(0).args).to.eql([
            db,
            channel.phoneNumber,
            publisher.phoneNumber,
          ])
        })
        it('returns SUCCESS status/message', () => {
          expect(result).to.eql({
            commandResult: {
              command: commands.LEAVE,
              status: statuses.SUCCESS,
              messageBody: CR.subscriber.remove.success,
            },
            dispatchable,
          })
        })
      })
    })

    describe('REMOVE command', () => {
      let validateStub, isPublisherStub, removePublisherStub

      beforeEach(() => {
        validateStub = sinon.stub(validator, 'validatePhoneNumber')
        isPublisherStub = sinon.stub(channelRepository, 'isPublisher')
        removePublisherStub = sinon.stub(channelRepository, 'removePublisher')
      })

      afterEach(() => {
        validateStub.restore()
        isPublisherStub.restore()
        removePublisherStub.restore()
      })

      describe('when sender is a publisher', () => {
        const sender = publisher
        beforeEach(() => removePublisherStub.returns(Promise.resolve()))

        describe('when payload is a valid phone number', () => {
          const payload = genPhoneNumber()
          beforeEach(() => validateStub.returns(true))

          describe('when removal target is a publisher', () => {
            beforeEach(() => isPublisherStub.returns(Promise.resolve(true)))

            it("attempts to remove the human from the chanel's publishers", async () => {
              await execute({ command: commands.REMOVE, payload, db, channel, sender })
              expect(removePublisherStub.getCall(0).args).to.eql([db, channel.phoneNumber, payload])
            })

            describe('when removing the publisher succeeds', () => {
              beforeEach(() => removePublisherStub.returns(Promise.resolve([1, 1])))

              it('returns a SUCCESS status and message', async () => {
                const dispatchable = { command: commands.REMOVE, payload, channel, sender }
                expect(await execute(dispatchable)).to.eql({
                  commandResult: {
                    command: commands.REMOVE,
                    status: statuses.SUCCESS,
                    messageBody: CR.publisher.remove.success(payload),
                  },
                  dispatchable,
                })
              })
            })

            describe('when removing the publisher fails', () => {
              beforeEach(() => removePublisherStub.callsFake(() => Promise.reject('oh noes!')))

              it('returns an ERROR status/message', async () => {
                const dispatchable = { command: commands.REMOVE, payload, channel, sender }
                expect(await execute(dispatchable)).to.eql({
                  commandResult: {
                    command: commands.REMOVE,
                    status: statuses.ERROR,
                    messageBody: CR.publisher.remove.dbError(payload),
                  },
                  dispatchable,
                })
              })
            })
          })

          describe('when removal target is not a publisher', () => {
            beforeEach(() => isPublisherStub.returns(Promise.resolve(false)))

            it('does not attempt to remove publisher', () => {
              expect(removePublisherStub.callCount).to.eql(0)
            })

            it('returns a SUCCESS status / NOOP message', async () => {
              const dispatchable = { command: commands.REMOVE, payload, channel, sender }
              expect(await execute(dispatchable)).to.eql({
                commandResult: {
                  command: commands.REMOVE,
                  status: statuses.ERROR,
                  messageBody: CR.publisher.remove.targetNotPublisher(payload),
                },
                dispatchable,
              })
            })
          })
        })

        describe('when payload is not a valid phone number', async () => {
          const dispatchable = { command: commands.REMOVE, payload: 'foo', channel, sender }
          let result
          beforeEach(async () => (result = await execute(dispatchable)))

          it('does not attempt to remove publisher', () => {
            expect(removePublisherStub.callCount).to.eql(0)
          })

          it('returns a SUCCESS status / NOOP message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.REMOVE,
                status: statuses.ERROR,
                messageBody: CR.publisher.remove.invalidNumber('foo'),
              },
              dispatchable,
            })
          })
        })
      })

      describe('when sender is not a publisher', () => {
        const sender = randomPerson
        const dispatchable = { command: commands.REMOVE, payload: 'foo', channel, sender }
        let result

        beforeEach(async () => (result = await execute(dispatchable)))

        it('does not attempt to add publisher', () => {
          expect(removePublisherStub.callCount).to.eql(0)
        })

        it('returns an SUCCESS status / NOT_NOOP message', () => {
          expect(result).to.eql({
            commandResult: {
              command: commands.REMOVE,
              status: statuses.UNAUTHORIZED,
              messageBody: CR.publisher.remove.unauthorized,
            },
            dispatchable,
          })
        })
      })
    })

    describe('RENAME command', () => {
      let updateStub
      beforeEach(() => (updateStub = sinon.stub(channelRepository, 'update')))
      afterEach(() => updateStub.restore())

      describe('when sender is a publisher', () => {
        const sender = publisher
        const dispatchable = { command: commands.RENAME, payload: 'newname', channel, sender }
        let result

        describe('when renaming succeeds', () => {
          beforeEach(async () => {
            updateStub.returns(Promise.resolve({ ...channel, name: 'newname' }))
            result = await execute(dispatchable)
          })

          it('returns SUCCESS status / message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.RENAME,
                status: statuses.SUCCESS,
                messageBody: CR.rename.success(channel.name, 'newname'),
              },
              dispatchable,
            })
          })
        })
        describe('when renaming fails', () => {
          beforeEach(async () => {
            updateStub.callsFake(() => Promise.reject('oh noes!'))
            result = await execute(dispatchable)
          })

          it('returns ERROR status / message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.RENAME,
                status: statuses.ERROR,
                messageBody: CR.rename.dbError(channel.name, 'newname'),
              },
              dispatchable,
            })
          })
        })
      })
      describe('when sender is a subscriber', () => {
        const sender = subscriber
        const dispatchable = { command: commands.RENAME, payload: 'newname', channel, sender }

        it('returns UNAUTHORIZED status / message', async () => {
          expect(await execute(dispatchable)).to.eql({
            commandResult: {
              command: commands.RENAME,
              status: statuses.UNAUTHORIZED,
              messageBody: CR.rename.unauthorized,
            },
            dispatchable,
          })
        })
      })
      describe('when sender is a random person', () => {
        const sender = randomPerson
        const dispatchable = { command: commands.RENAME, payload: 'newname', channel, sender }

        it('returns UNAUTHORIZED status / message', async () => {
          expect(await execute(dispatchable)).to.eql({
            commandResult: {
              command: commands.RENAME,
              status: statuses.UNAUTHORIZED,
              messageBody: CR.rename.unauthorized,
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
            messageBody: CR.noop,
          },
          dispatchable,
        })
      })
    })
  })
})
