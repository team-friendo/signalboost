import { expect } from 'chai'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import commonService from '../../../../app/registrar/phoneNumber/common'
import sinon from 'sinon'
import fs from 'fs-extra'
import { map } from 'lodash'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import channelRepository from '../../../../app/db/repositories/channel'
import eventRepository from '../../../../app/db/repositories/event'
import signal from '../../../../app/signal'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import { destroy } from '../../../../app/registrar/phoneNumber/destroy'
import { deepChannelFactory } from '../../../support/factories/channel'
import { eventFactory } from '../../../support/factories/event'
import { eventTypes } from '../../../../app/db/models/event'
import { genPhoneNumber, phoneNumberFactory } from '../../../support/factories/phoneNumber'

describe('phone number services -- destroy module', () => {
  const phoneNumber = genPhoneNumber()
  const phoneNumberRecord = phoneNumberFactory({ phoneNumber })
  const channel = deepChannelFactory({ phoneNumber })
  const sender = channel.memberships[0].memberPhoneNumber

  let findChannelStub,
    findPhoneNumberStub,
    broadcastMessageStub,
    destroyChannelStub,
    destroyPhoneNumberStub,
    deleteDirStub,
    twilioRemoveStub,
    signaldUnsubscribeStub,
    logEventStub,
    commitStub,
    rollbackStub

  before(async () => {
    await app.run(testApp)
  })

  beforeEach(() => {
    commitStub = sinon.stub()
    rollbackStub = sinon.stub()
    sinon.stub(app.db.sequelize, 'transaction').returns({
      commit: commitStub,
      rollback: rollbackStub,
    })
    findChannelStub = sinon.stub(channelRepository, 'findDeep')
    findPhoneNumberStub = sinon.stub(phoneNumberRepository, 'find')
    broadcastMessageStub = sinon.stub(signal, 'broadcastMessage')
    destroyChannelStub = sinon.stub(channelRepository, 'destroy')
    destroyPhoneNumberStub = sinon.stub(phoneNumberRepository, 'destroy')
    twilioRemoveStub = sinon.stub()
    sinon.stub(commonService, 'getTwilioClient').callsFake(() => ({
      incomingPhoneNumbers: () => ({ remove: twilioRemoveStub }),
    }))
    deleteDirStub = sinon.stub(fs, 'remove').returns(['/var/lib'])
    signaldUnsubscribeStub = sinon.stub(signal, 'unsubscribe')
    logEventStub = sinon
      .stub(eventRepository, 'log')
      .returns(Promise.resolve(eventFactory({ type: eventTypes.CHANNEL_DESTROYED })))
  })

  afterEach(() => sinon.restore())
  after(async () => await app.stop())

  // TESTS

  describe('destroying phone numbers', () => {
    describe('when phone number does not exist in channels db', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(null))
      })

      describe('when phone number does not exist in phone number db', () => {
        beforeEach(async () => {
          findPhoneNumberStub.returns(Promise.resolve(null))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `No records found for ${phoneNumber}`,
            status: 'ERROR',
          })
        })
      })

      describe('when phone number exists but no channel uses it', () => {
        beforeEach(async () => {
          // no channel
          findChannelStub.returns(Promise.resolve(null))
          // yes phone number
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          // all helpers succeed
          broadcastMessageStub.returns(Promise.resolve())
          deleteDirStub.returns(Promise.resolve())
          twilioRemoveStub.returns(Promise.resolve())
          destroyPhoneNumberStub.returns(Promise.resolve())
        })

        it('destroys the phone number', async () => {
          await destroy({ phoneNumber })
          expect(destroyPhoneNumberStub.callCount).to.eql(1)
        })

        it('releases the phone number back to twilio', async () => {
          await destroy({ phoneNumber })
          expect(twilioRemoveStub.callCount).to.eql(1)
        })

        it('returns SUCCESS', async () => {
          const response = await destroy({ phoneNumber })
          expect(response.status).to.eql('SUCCESS')
        })

        it('does not attempt to notify members of non-existent channel', async () => {
          await destroy({ phoneNumber })
          expect(broadcastMessageStub.callCount).to.eql(0)
        })

        it('does not attempt to destroy a channel', async () => {
          await destroy({ phoneNumber })
          expect(destroyChannelStub.callCount).to.eql(0)
        })
      })
    })

    describe('when channel exists with given phone number', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve({}))
      })

      describe('all tasks succeed', () => {
        beforeEach(async () => {
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          broadcastMessageStub.returns(Promise.resolve())
          deleteDirStub.returns(Promise.resolve())
          twilioRemoveStub.returns(Promise.resolve())
          destroyPhoneNumberStub.returns(Promise.resolve())
        })

        describe('destroy command called from maintainer', () => {
          it('notifies all the members of the channel of destruction', async () => {
            await destroy({ phoneNumber })
            expect(broadcastMessageStub.getCall(0).args[0]).to.eql(
              map(channel.memberships, 'memberPhoneNumber'),
            )
          })
        })

        describe('destroy command called from admin of channel', () => {
          it('notifies all members of the channel except for the sender', async () => {
            await destroy({ phoneNumber, sender })
            expect(broadcastMessageStub.getCall(0).args[0]).to.eql(
              map(channel.memberships, 'memberPhoneNumber').slice(1),
            )
          })
        })

        it('destroys the channel in the db', async () => {
          await destroy({ phoneNumber })
          expect(destroyChannelStub.callCount).to.eql(1)
        })

        it('logs a CHANNEL_DESTROYED event', async () => {
          await destroy({ phoneNumber })
          expect(logEventStub.getCall(0).args.slice(0, -1)).to.eql([
            eventTypes.CHANNEL_DESTROYED,
            phoneNumber,
          ])
        })

        it("deletes the channel's signal keystore", async () => {
          await destroy({ phoneNumber })
          expect(map(deleteDirStub.getCalls(), 'args')).to.eql([
            [`/var/lib/signald/data/${phoneNumber}`],
            [`/var/lib/signald/data/${phoneNumber}.d`],
          ])
        })

        it('releases the phone number to twilio', async () => {
          await destroy({ phoneNumber })
          expect(twilioRemoveStub.callCount).to.eql(1)
        })

        it('destroys the phoneNumber in the db', async () => {
          await destroy({ phoneNumber })
          expect(destroyPhoneNumberStub.callCount).to.eql(1)
        })

        it('unsubscribes the phoneNumber from signald', async () => {
          await destroy({ phoneNumber })
          expect(signaldUnsubscribeStub.callCount).to.eql(1)
        })

        it('commits the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(commitStub.callCount).to.eql(1)
        })

        it('returns a success status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            status: 'SUCCESS',
            msg: 'All records of phone number have been destroyed.',
          })
        })
      })

      describe('when notifying members fails', () => {
        beforeEach(async () => {
          // business logic succeeds
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          destroyChannelStub.returns(Promise.resolve(true))
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.returns(Promise.resolve())
          broadcastMessageStub.returns(Promise.resolve())
          deleteDirStub.returns(Promise.resolve())
          // notifying members fails
          broadcastMessageStub
            .onCall(0)
            .callsFake(() => Promise.reject('Failed to broadcast message'))
          // notifying maintainers of error succeeds
          broadcastMessageStub.onCall(1).returns(Promise.resolve())
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Failed to destroy channel for ${phoneNumber}. Error: Failed to broadcast message`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })

      describe('when deleting the phone number from the db fails', () => {
        beforeEach(async () => {
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          destroyPhoneNumberStub.callsFake(() => Promise.reject('Gnarly db error!'))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Failed to destroy channel for ${phoneNumber}. Error: Gnarly db error!`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })

      describe('when releasing the phone number back to twilio fails', () => {
        beforeEach(async () => {
          // finding works
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          // destroying phone number works
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.callsFake(() => Promise.reject({ message: 'oh noes!' }))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Failed to destroy channel for ${phoneNumber}. Error: Failed to release phone number back to Twilio: {"message":"oh noes!"}`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })

      describe('when deleting the channel from the db fails', () => {
        beforeEach(async () => {
          // finding works
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          // destroying/releasing phone number works
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.returns(Promise.resolve)
          // destroying channel throws
          destroyChannelStub.callsFake(() => Promise.reject('Gnarly db error!'))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Failed to destroy channel for ${phoneNumber}. Error: Gnarly db error!`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })

      describe('when destroying the signal entry data fails', () => {
        beforeEach(async () => {
          // finding works
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          // destroying phone number & channel works
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.returns(Promise.resolve())
          destroyChannelStub.returns(Promise.resolve())
          // destroying keystore fails
          deleteDirStub.callsFake(() => Promise.reject('File system go BOOM!'))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Failed to destroy channel for ${phoneNumber}. Error: Failed to destroy signal entry data in keystore`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })

      describe('when unsubscribing from signald fails', () => {
        beforeEach(async () => {
          // finding works
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          // destroying phone number & channel works
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.returns(Promise.resolve())
          destroyChannelStub.returns(Promise.resolve())
          // destroying keystore succeds
          deleteDirStub.returns(Promise.resolve())
          signaldUnsubscribeStub.callsFake(() => Promise.reject('BOOM!'))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Failed to destroy channel for ${phoneNumber}. Error: BOOM!`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })
    })
  })
})
