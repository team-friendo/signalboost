import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import {
  commands,
  statuses,
  parseCommand,
  processCommand,
} from '../../../../app/services/dispatcher/executor'
import { commandResponses as CR } from '../../../../app/services/dispatcher/messages'
import channelRepository from '../../../../app/db/repositories/channel'
import validator from '../../../../app/db/validations'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { publicationFactory } from '../../../support/factories/publication'
import { sdMessageOf } from '../../../../app/services/dispatcher/messenger'

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
          const sdMessage = sdMessageOf(channel, `ADD ${payload}`)
          const dispatchable = { db, channel, sender, sdMessage }

          beforeEach(() => addPublisherStub.returns(Promise.resolve()))

          it("attempts to add payload number to the chanel's publishers", async () => {
            await processCommand(dispatchable)
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
              expect(await processCommand(dispatchable)).to.eql({
                commandResult: {
                  command: commands.ADD,
                  status: statuses.SUCCESS,
                  message: CR.publisher.add.success(payload),
                  payload,
                },
                dispatchable,
              })
            })
          })

          describe('when adding the publisher fails', () => {
            beforeEach(() => addPublisherStub.callsFake(() => Promise.reject('oh noes!')))

            it('returns an ERROR status and message', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                commandResult: {
                  command: commands.ADD,
                  status: statuses.ERROR,
                  message: CR.publisher.add.dbError(payload),
                },
                dispatchable,
              })
            })
          })
        })

        describe('when payload is not a valid phone number', async () => {
          const dispatchable = { db, channel, sender, sdMessage: sdMessageOf(channel, 'ADD foo') }
          let result
          beforeEach(async () => (result = await processCommand(dispatchable)))

          it('does not attempt to add publisher', () => {
            expect(addPublisherStub.callCount).to.eql(0)
          })

          it('returns a ERROR status/message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.ADD,
                status: statuses.ERROR,
                message: CR.publisher.add.invalidNumber('foo'),
              },
              dispatchable,
            })
          })
        })
      })

      describe('when sender is not a publisher', () => {
        const dispatchable = {
          db,
          channel,
          sender: subscriber,
          sdMessage: sdMessageOf(channel, 'ADD me'),
        }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not attempt to add publisher', () => {
          expect(addPublisherStub.callCount).to.eql(0)
        })

        it('returns an UNAUTHORIZED status/message', () => {
          expect(result).to.eql({
            commandResult: {
              command: commands.ADD,
              status: statuses.UNAUTHORIZED,
              message: CR.publisher.add.unauthorized,
            },
            dispatchable,
          })
        })
      })
    })

    describe('HELP command', () => {
      const sdMessage = sdMessageOf(channel, 'HELP')

      describe('when sender is a publisher', () => {
        const dispatchable = { db, channel, sender: publisher, sdMessage }

        it('sends a help message to sender', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            commandResult: {
              command: commands.HELP,
              status: statuses.SUCCESS,
              message: CR.help.publisher,
            },
            dispatchable,
          })
        })
      })

      describe('when sender is a subscriber', () => {
        const dispatchable = { db, channel, sender: subscriber, sdMessage }

        it('sends a help message to sender', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            commandResult: {
              command: commands.HELP,
              status: statuses.SUCCESS,
              message: CR.help.subscriber,
            },
            dispatchable,
          })
        })
      })

      describe('when sender is a random person', () => {
        const dispatchable = { db, channel, sender: randomPerson, sdMessage }

        it('sends an UNAUTHORIZED message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            commandResult: {
              command: commands.HELP,
              status: statuses.UNAUTHORIZED,
              message: CR.help.unauthorized,
            },
            dispatchable,
          })
        })
      })
    })

    describe('INFO command', () => {
      const sdMessage = sdMessageOf(channel, 'INFO')

      describe('when sender is a publisher', () => {
        const dispatchable = { db, channel, sender: publisher, sdMessage }

        it('sends an info message with more information', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            commandResult: {
              command: commands.INFO,
              status: statuses.SUCCESS,
              message: CR.info.publisher(channel),
            },
            dispatchable,
          })
        })
      })

      describe('when sender is a subscriber', () => {
        const dispatchable = { db, channel, sender: subscriber, sdMessage }

        it('sends an info message with less information', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            commandResult: {
              command: commands.INFO,
              status: statuses.SUCCESS,
              message: CR.info.subscriber(channel),
            },
            dispatchable,
          })
        })
      })

      describe('when sender is neither publisher nor subscriber', () => {
        const dispatchable = { db, channel, sender: randomPerson, sdMessage }

        it('sends an UNAUTHORIZED message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
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

    describe('JOIN command', () => {
      const sdMessage = sdMessageOf(channel, 'JOIN')
      let addSubscriberStub

      beforeEach(() => (addSubscriberStub = sinon.stub(channelRepository, 'addSubscriber')))
      afterEach(() => addSubscriberStub.restore())

      describe('when number is not subscribed to channel', () => {
        const dispatchable = { db, channel, sender: randomPerson, sdMessage }

        describe('when adding subscriber succeeds', () => {
          beforeEach(() => addSubscriberStub.returns(Promise.resolve(subscriptionFactory())))

          it('returns SUCCESS status/message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              commandResult: {
                command: commands.JOIN,
                status: statuses.SUCCESS,
                message: CR.subscriber.add.success(channel),
              },
              dispatchable,
            })
          })
        })

        describe('when adding subscriber fails', () => {
          beforeEach(() => addSubscriberStub.callsFake(() => Promise.reject('foo')))

          it('returns ERROR status/message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
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
        const dispatchable = { db, channel, sender: subscriber, sdMessage }
        let result

        beforeEach(async () => (result = await processCommand(dispatchable)))

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
    })

    describe('LEAVE command', () => {
      const sdMessage = sdMessageOf(channel, 'LEAVE')
      let removeSubscriberStub
      beforeEach(() => (removeSubscriberStub = sinon.stub(channelRepository, 'removeSubscriber')))
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
            expect(await processCommand(dispatchable)).to.eql({
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

      describe('when sender is not subscribed to channel', () => {
        const dispatchable = { db, channel, sender: randomPerson, sdMessage }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

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

      describe('when sender is a publisher', () => {
        let result, removePublisherStub
        const dispatchable = { db, channel, sender: publisher, sdMessage }

        beforeEach(async () => {
          removePublisherStub = sinon
            .stub(channelRepository, 'removePublisher')
            .returns(Promise.resolve([1, 1]))
          result = await processCommand(dispatchable)
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
              message: CR.subscriber.remove.success,
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
          const sdMessage = sdMessageOf(channel, `REMOVE ${payload}`)
          const dispatchable = { db, channel, sender, sdMessage }
          beforeEach(() => validateStub.returns(true))

          describe('when removal target is a publisher', () => {
            beforeEach(() => isPublisherStub.returns(Promise.resolve(true)))

            it("attempts to remove the human from the chanel's publishers", async () => {
              await processCommand(dispatchable)
              expect(removePublisherStub.getCall(0).args).to.eql([db, channel.phoneNumber, payload])
            })

            describe('when removing the publisher succeeds', () => {
              beforeEach(() => removePublisherStub.returns(Promise.resolve([1, 1])))

              it('returns a SUCCESS status and message', async () => {
                expect(await processCommand(dispatchable)).to.eql({
                  commandResult: {
                    command: commands.REMOVE,
                    status: statuses.SUCCESS,
                    message: CR.publisher.remove.success(payload),
                  },
                  dispatchable,
                })
              })
            })

            describe('when removing the publisher fails', () => {
              beforeEach(() => removePublisherStub.callsFake(() => Promise.reject('oh noes!')))

              it('returns an ERROR status/message', async () => {
                expect(await processCommand(dispatchable)).to.eql({
                  commandResult: {
                    command: commands.REMOVE,
                    status: statuses.ERROR,
                    message: CR.publisher.remove.dbError(payload),
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
              expect(await processCommand(dispatchable)).to.eql({
                commandResult: {
                  command: commands.REMOVE,
                  status: statuses.ERROR,
                  message: CR.publisher.remove.targetNotPublisher(payload),
                },
                dispatchable,
              })
            })
          })
        })

        describe('when payload is not a valid phone number', async () => {
          const sdMessage = sdMessageOf(channel, 'REMOVE foo')
          const dispatchable = { db, channel, sender, sdMessage }
          let result
          beforeEach(async () => (result = await processCommand(dispatchable)))

          it('does not attempt to remove publisher', () => {
            expect(removePublisherStub.callCount).to.eql(0)
          })

          it('returns a SUCCESS status / NOOP message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.REMOVE,
                status: statuses.ERROR,
                message: CR.publisher.remove.invalidNumber('foo'),
              },
              dispatchable,
            })
          })
        })
      })

      describe('when sender is not a publisher', () => {
        const sdMessage = sdMessageOf(channel, `REMOVE ${genPhoneNumber()}`)
        const dispatchable = { db, channel, sender: randomPerson, sdMessage }
        let result

        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not attempt to add publisher', () => {
          expect(removePublisherStub.callCount).to.eql(0)
        })

        it('returns an SUCCESS status / NOT_NOOP message', () => {
          expect(result).to.eql({
            commandResult: {
              command: commands.REMOVE,
              status: statuses.UNAUTHORIZED,
              message: CR.publisher.remove.unauthorized,
            },
            dispatchable,
          })
        })
      })
    })

    describe('RENAME command', () => {
      const sdMessage = sdMessageOf(channel, 'RENAME foo')
      let updateStub
      beforeEach(() => (updateStub = sinon.stub(channelRepository, 'update')))
      afterEach(() => updateStub.restore())

      describe('when sender is a publisher', () => {
        const dispatchable = { db, channel, sender: publisher, sdMessage }
        let result

        describe('when renaming succeeds', () => {
          beforeEach(async () => {
            updateStub.returns(Promise.resolve({ ...channel, name: 'foo' }))
            result = await processCommand(dispatchable)
          })

          it('returns SUCCESS status / message', () => {
            expect(result).to.eql({
              commandResult: {
                command: commands.RENAME,
                status: statuses.SUCCESS,
                message: CR.rename.success(channel.name, 'foo'),
              },
              dispatchable,
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
              commandResult: {
                command: commands.RENAME,
                status: statuses.ERROR,
                message: CR.rename.dbError(channel.name, 'foo'),
              },
              dispatchable,
            })
          })
        })
      })

      describe('when sender is a subscriber', () => {
        const dispatchable = { db, channel, sender: subscriber, sdMessage }

        it('returns UNAUTHORIZED status / message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            commandResult: {
              command: commands.RENAME,
              status: statuses.UNAUTHORIZED,
              message: CR.rename.unauthorized,
            },
            dispatchable,
          })
        })
      })

      describe('when sender is a random person', () => {
        const dispatchable = { db, channel, sender: randomPerson, sdMessage }

        it('returns UNAUTHORIZED status / message', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            commandResult: {
              command: commands.RENAME,
              status: statuses.UNAUTHORIZED,
              message: CR.rename.unauthorized,
            },
            dispatchable,
          })
        })
      })
    })

    describe('invalid command', () => {
      it('returns NOOP status/message', async () => {
        const dispatchable = {
          db,
          channel,
          sender: publisher,
          sdMessage: sdMessageOf(channel, 'foo'),
        }
        expect(await processCommand(dispatchable)).to.eql({
          commandResult: {
            command: commands.NOOP,
            status: statuses.NOOP,
            message: CR.noop,
          },
          dispatchable,
        })
      })
    })
  })
})
