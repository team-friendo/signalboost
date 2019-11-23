import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import { processCommand } from '../../../../../app/services/dispatcher/commands'
import { commands, statuses } from '../../../../../app/services/dispatcher/commands/constants'
import { languages } from '../../../../../app/constants'
import { commandResponses as CR } from '../../../../../app/services/dispatcher/strings/messages/EN'
import channelRepository from '../../../../../app/db/repositories/channel'
import membershipRepository from '../../../../../app/db/repositories/membership'
import validator from '../../../../../app/db/validations/phoneNumber'
import { subscriptionFactory } from '../../../../support/factories/subscription'
import { genPhoneNumber } from '../../../../support/factories/phoneNumber'
import { publicationFactory } from '../../../../support/factories/publication'
import { memberTypes } from '../../../../../app/db/repositories/membership'
import { sdMessageOf } from '../../../../../app/services/signal'
const {
  signal: { signupPhoneNumber },
} = require('../../../../../app/config')

describe('executing commands', () => {
  const db = {}
  const channel = {
    name: 'foobar',
    phoneNumber: '+13333333333',
    publications: times(2, () => publicationFactory({ channelPhoneNumber: '+13333333333' })),
    subscriptions: times(2, () => subscriptionFactory({ channelPhoneNumber: '+13333333333' })),
    messageCount: { broadcastIn: 42 },
  }
  const signupChannel = {
    name: 'SB_SIGNUP',
    phoneNumber: signupPhoneNumber,
    publications: channel.publications,
  }
  const publisher = {
    phoneNumber: '+11111111111',
    type: memberTypes.ADMIN,
    language: languages.EN,
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

  describe('ADD command', () => {
    let addAdminStub
    beforeEach(() => (addAdminStub = sinon.stub(membershipRepository, 'addAdmin')))
    afterEach(() => addAdminStub.restore())

    describe('when sender is a publisher', () => {
      const sender = publisher

      describe('when payload is a valid phone number', () => {
        const payload = '+1 (555) 555-5555' // to ensure we catch errors
        const publisherPhoneNumber = '+15555555555'
        const sdMessage = sdMessageOf(channel, `ADD ${payload}`)
        const dispatchable = { db, channel, sender, sdMessage }

        beforeEach(() => addAdminStub.returns(Promise.resolve()))

        it("attempts to add payload number to the chanel's publishers", async () => {
          await processCommand(dispatchable)
          expect(addAdminStub.getCall(0).args).to.eql([
            db,
            channel.phoneNumber,
            publisherPhoneNumber,
          ])
        })

        describe('when adding the publisher succeeds', () => {
          beforeEach(() =>
            addAdminStub.returns(
              Promise.resolve([{ channelPhoneNumber: channel.phoneNumber, publisherPhoneNumber }]),
            ),
          )

          it('returns a SUCCESS status / message and publisher number as payload', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.ADD,
              status: statuses.SUCCESS,
              message: CR.add.success(publisherPhoneNumber),
              payload: publisherPhoneNumber,
            })
          })
        })

        describe('when adding the publisher fails', () => {
          beforeEach(() => addAdminStub.callsFake(() => Promise.reject('oh noes!')))

          it('returns an ERROR status and message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.ADD,
              status: statuses.ERROR,
              message: CR.add.dbError(publisherPhoneNumber),
            })
          })
        })
      })

      describe('when payload is not a valid phone number', async () => {
        const dispatchable = { db, channel, sender, sdMessage: sdMessageOf(channel, 'ADD foo') }
        let result
        beforeEach(async () => (result = await processCommand(dispatchable)))

        it('does not attempt to add publisher', () => {
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
        expect(addAdminStub.callCount).to.eql(0)
      })

      it('returns an UNAUTHORIZED status/message', () => {
        expect(result).to.eql({
          command: commands.ADD,
          status: statuses.UNAUTHORIZED,
          message: CR.add.unauthorized,
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
          command: commands.HELP,
          status: statuses.SUCCESS,
          message: CR.help.publisher,
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

      it('sends an UNAUTHORIZED message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.HELP,
          status: statuses.UNAUTHORIZED,
          message: CR.help.unauthorized,
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
          command: commands.INFO,
          status: statuses.SUCCESS,
          message: CR.info.publisher(channel),
        })
      })
    })

    describe('when sender is a subscriber', () => {
      const dispatchable = { db, channel, sender: subscriber, sdMessage }

      it('sends an info message with less information', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          status: statuses.SUCCESS,
          message: CR.info.subscriber(channel),
        })
      })
    })

    describe('when sender is neither publisher nor subscriber', () => {
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }

      it('sends an UNAUTHORIZED message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.INFO,
          status: statuses.UNAUTHORIZED,
          message: CR.info.unauthorized,
        })
      })
    })
  })

  describe('JOIN command', () => {
    const sdMessage = sdMessageOf(channel, 'JOIN')
    let addSubscriberStub

    beforeEach(() => (addSubscriberStub = sinon.stub(membershipRepository, 'addSubscriber')))
    afterEach(() => addSubscriberStub.restore())

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

      it('returns NOOP status/message', () => {
        expect(result).to.eql({
          command: commands.JOIN,
          status: statuses.NOOP,
          message: CR.join.noop,
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
          message: CR.leave.unauthorized,
        })
      })
    })

    describe('when sender is a publisher', () => {
      let result, removeAdminStub
      const dispatchable = { db, channel, sender: publisher, sdMessage }

      beforeEach(async () => {
        removeAdminStub = sinon
          .stub(membershipRepository, 'removeAdmin')
          .returns(Promise.resolve([1, 1]))
        result = await processCommand(dispatchable)
      })
      afterEach(() => removeAdminStub.restore())

      it('removes sender as publisher of channel', () => {
        expect(removeAdminStub.getCall(0).args).to.eql([
          db,
          channel.phoneNumber,
          publisher.phoneNumber,
        ])
      })

      it('returns SUCCESS status/message', () => {
        expect(result).to.eql({
          command: commands.LEAVE,
          status: statuses.SUCCESS,
          message: CR.leave.success,
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

    describe('when sender is a publisher', () => {
      const sender = publisher
      beforeEach(() => removeAdminStub.returns(Promise.resolve()))

      describe('when payload is a valid phone number', () => {
        const payload = '+1 (555) 555-5555' // to ensure we catch errors
        const publisherPhoneNumber = '+15555555555'
        const sdMessage = sdMessageOf(channel, `REMOVE ${payload}`)
        const dispatchable = { db, channel, sender, sdMessage }
        beforeEach(() => validateStub.returns(true))

        describe('when removal target is a publisher', () => {
          beforeEach(() => isAdminStub.returns(Promise.resolve(true)))

          it("attempts to remove the human from the chanel's publishers", async () => {
            await processCommand(dispatchable)
            expect(removeAdminStub.getCall(0).args).to.eql([
              db,
              channel.phoneNumber,
              publisherPhoneNumber,
            ])
          })

          describe('when removing the publisher succeeds', () => {
            beforeEach(() => removeAdminStub.returns(Promise.resolve([1, 1])))

            it('returns a SUCCESS status and message', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.REMOVE,
                status: statuses.SUCCESS,
                message: CR.remove.success(publisherPhoneNumber),
              })
            })
          })

          describe('when removing the publisher fails', () => {
            beforeEach(() => removeAdminStub.callsFake(() => Promise.reject('oh noes!')))

            it('returns an ERROR status/message', async () => {
              expect(await processCommand(dispatchable)).to.eql({
                command: commands.REMOVE,
                status: statuses.ERROR,
                message: CR.remove.dbError(publisherPhoneNumber),
              })
            })
          })
        })

        describe('when removal target is not a publisher', () => {
          beforeEach(() => isAdminStub.returns(Promise.resolve(false)))

          it('does not attempt to remove publisher', () => {
            expect(removeAdminStub.callCount).to.eql(0)
          })

          it('returns a SUCCESS status / NOOP message', async () => {
            expect(await processCommand(dispatchable)).to.eql({
              command: commands.REMOVE,
              status: statuses.ERROR,
              message: CR.remove.targetNotPublisher(publisherPhoneNumber),
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

    describe('when sender is not a publisher', () => {
      const sdMessage = sdMessageOf(channel, `REMOVE ${genPhoneNumber()}`)
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }
      let result

      beforeEach(async () => (result = await processCommand(dispatchable)))

      it('does not attempt to add publisher', () => {
        expect(removeAdminStub.callCount).to.eql(0)
      })

      it('returns an SUCCESS status / NOT_NOOP message', () => {
        expect(result).to.eql({
          command: commands.REMOVE,
          status: statuses.UNAUTHORIZED,
          message: CR.remove.unauthorized,
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
            command: commands.RENAME,
            status: statuses.SUCCESS,
            message: CR.rename.success(channel.name, 'foo'),
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
          message: CR.rename.unauthorized,
        })
      })
    })

    describe('when sender is a random person', () => {
      const dispatchable = { db, channel, sender: randomPerson, sdMessage }

      it('returns UNAUTHORIZED status / message', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RENAME,
          status: statuses.UNAUTHORIZED,
          message: CR.rename.unauthorized,
        })
      })
    })
  })

  describe('RESPONSES_ON command', () => {
    let updateChannelStub
    beforeEach(() => (updateChannelStub = sinon.stub(channelRepository, 'update')))
    afterEach(() => updateChannelStub.restore())

    describe('when sender is a publisher', () => {
      const sender = publisher

      const sdMessage = sdMessageOf(channel, 'RESPONSES ON')
      const dispatchable = { db, channel, sender, sdMessage }

      it('attempts to update the responsesEnabled field on the channel', async () => {
        updateChannelStub.returns(Promise.resolve())
        await processCommand(dispatchable)
        expect(updateChannelStub.getCall(0).args).to.have.deep.members([
          db,
          channel.phoneNumber,
          { responsesEnabled: true },
        ])
      })

      describe('when db update succeeds', () => {
        beforeEach(() => updateChannelStub.returns(Promise.resolve()))

        it('returns a SUCCESS status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.RESPONSES_ON,
            status: statuses.SUCCESS,
            message: CR.toggleResponses.success('ON'),
          })
        })
      })

      describe('when db update fails', () => {
        beforeEach(() => updateChannelStub.callsFake(() => Promise.reject(new Error('db error'))))

        it('returns an ERROR status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.RESPONSES_ON,
            status: statuses.ERROR,
            message: CR.toggleResponses.dbError('ON'),
          })
        })
      })
    })

    describe('when sender is a subscriber', () => {
      const sender = subscriber
      const sdMessage = sdMessageOf(channel, 'RESPONSES ON')
      const dispatchable = { db, channel, sender, sdMessage }

      it('returns an UNAUTHORIZED status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RESPONSES_ON,
          status: statuses.UNAUTHORIZED,
          message: CR.toggleResponses.unauthorized,
        })
      })
    })

    describe('when sender is a random person', () => {
      const sender = randomPerson
      const sdMessage = sdMessageOf(channel, 'RESPONSES ON')
      const dispatchable = { db, channel, sender, sdMessage }

      it('returns an UNAUTHORIZED status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RESPONSES_ON,
          status: statuses.UNAUTHORIZED,
          message: CR.toggleResponses.unauthorized,
        })
      })
    })
  })

  describe('RESPONSES_OFF command', () => {
    let updateChannelStub
    beforeEach(() => (updateChannelStub = sinon.stub(channelRepository, 'update')))
    afterEach(() => updateChannelStub.restore())

    describe('when sender is a publisher', () => {
      const sender = publisher

      const sdMessage = sdMessageOf(channel, 'RESPONSES OFF')
      const dispatchable = { db, channel, sender, sdMessage }

      it('attempts to update the responsesEnabled field on the channel', async () => {
        updateChannelStub.returns(Promise.resolve())
        await processCommand(dispatchable)
        expect(updateChannelStub.getCall(0).args).to.have.deep.members([
          db,
          channel.phoneNumber,
          { responsesEnabled: false },
        ])
      })

      describe('when db update succeeds', () => {
        beforeEach(() => updateChannelStub.returns(Promise.resolve()))

        it('returns a SUCCESS status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.RESPONSES_OFF,
            status: statuses.SUCCESS,
            message: CR.toggleResponses.success('OFF'),
          })
        })
      })

      describe('when db update fails', () => {
        beforeEach(() => updateChannelStub.callsFake(() => Promise.reject(new Error('db error'))))

        it('returns an ERROR status', async () => {
          expect(await processCommand(dispatchable)).to.eql({
            command: commands.RESPONSES_OFF,
            status: statuses.ERROR,
            message: CR.toggleResponses.dbError('OFF'),
          })
        })
      })
    })

    describe('when sender is a subscriber', () => {
      const sender = subscriber
      const sdMessage = sdMessageOf(channel, 'RESPONSES OFF')
      const dispatchable = { db, channel, sender, sdMessage }

      it('returns an UNAUTHORIZED status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RESPONSES_OFF,
          status: statuses.UNAUTHORIZED,
          message: CR.toggleResponses.unauthorized,
        })
      })
    })

    describe('when sender is a random person', () => {
      const sender = randomPerson
      const sdMessage = sdMessageOf(channel, 'RESPONSES OFF')
      const dispatchable = { db, channel, sender, sdMessage }

      it('returns an UNAUTHORIZED status', async () => {
        expect(await processCommand(dispatchable)).to.eql({
          command: commands.RESPONSES_OFF,
          status: statuses.UNAUTHORIZED,
          message: CR.toggleResponses.unauthorized,
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
        sender: publisher,
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
