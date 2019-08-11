import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../../../../app/db/repositories/channel'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import signal from '../../../../../app/services/signal'
import messenger from '../../../../../app/services/dispatcher/messenger'
import { create } from '../../../../../app/services/registrar/channel/create'

describe('channel creation module', () => {
  const db = {}
  const sock = {}
  const phoneNumber = '+15555555555'
  const name = '#blackops'
  const publishers = ['+12222222222', '+13333333333']
  const channelInstance = {
    dataValues: {
      phoneNumber,
      name,
      publications: [
        { channelPhoneNumber: phoneNumber, publisherPhoneNumber: publishers[0] },
        { channelPhoneNumber: phoneNumber, publisherPhoneNumber: publishers[1] },
      ],
    },
  }
  const activePhoneNumberInstance = {
    dataValues: {
      phoneNumber,
      status: 'ACTIVE',
    },
  }
  let subscribeStub, createChannelStub, updatePhoneNumberStub, welcomePublisherStub

  beforeEach(() => {
    subscribeStub = sinon.stub(signal, 'subscribe')
    createChannelStub = sinon.stub(channelRepository, 'create')
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    welcomePublisherStub = sinon.stub(messenger, 'welcomeNewPublisher')
  })

  afterEach(() => {
    subscribeStub.restore()
    createChannelStub.restore()
    updatePhoneNumberStub.restore()
    welcomePublisherStub.restore()
  })

  describe('creating a channel', () => {
    beforeEach(() => {
      updatePhoneNumberStub.returns(
        Promise.resolve({ dataValues: { phoneNumber, status: 'ACTIVE' } }),
      )
    })

    describe('when subscribing to signal messages succeeds', () => {
      beforeEach(() => subscribeStub.returns(Promise.resolve()))

      describe('in all cases', () => {
        beforeEach(async () => {
          await create({ db, sock, phoneNumber, name, publishers })
        })

        it('creates a channel resource', () => {
          expect(createChannelStub.getCall(0).args).to.eql([db, phoneNumber, name, publishers])
        })

        it('sets the phone number resource status to active', () => {
          expect(updatePhoneNumberStub.getCall(0).args).to.eql([
            db,
            phoneNumber,
            { status: 'ACTIVE' },
          ])
        })
      })

      describe('when both db writes succeed', () => {
        beforeEach(() => {
          createChannelStub.returns(Promise.resolve(channelInstance))
          updatePhoneNumberStub.returns(Promise.resolve(activePhoneNumberInstance))
        })

        it('sends a welcome message to new publishers', async () => {
          await create({ db, sock, phoneNumber, name, publishers, welcome: welcomePublisherStub })
          expect(welcomePublisherStub.callCount).to.eql(publishers.length)
          expect(welcomePublisherStub.getCall(0).args).to.eql([
            {
              db,
              sock,
              channel: {
                phoneNumber,
                name,
                subscriptions: [],
                publications: [
                  { channelPhoneNumber: phoneNumber, publisherPhoneNumber: publishers[0] },
                  { channelPhoneNumber: phoneNumber, publisherPhoneNumber: publishers[1] },
                ],
              },
              newPublisher: publishers[0],
              addingPublisher: 'the system administrator',
            },
          ])
        })

        describe('when sending welcome messages succeeds', () => {
          beforeEach(() => {
            welcomePublisherStub.returns(Promise.resolve())
          })

          it('returns a success message', async function() {
            expect(await create({ db, sock, phoneNumber, name, publishers })).to.eql({
              status: 'ACTIVE',
              phoneNumber,
              name,
              publishers,
            })
          })
        })

        describe('when sending welcome message fails', () => {
          beforeEach(() => {
            welcomePublisherStub.callsFake(() => Promise.reject(new Error('oh noes!')))
          })

          it('returns an error message', async () => {
            const result = await create({ db, sock, phoneNumber, name, publishers })
            expect(result).to.eql({
              status: 'ERROR',
              error: 'oh noes!',
              request: {
                phoneNumber,
                name,
                publishers,
              },
            })
          })
        })
      })

      describe('when creating channel fails', () => {
        let result
        beforeEach(async () => {
          createChannelStub.callsFake(() => Promise.reject(new Error('db error!')))
          result = await create({ db, sock, phoneNumber, name, publishers })
        })

        it('does not send welcome messages', () => {
          expect(welcomePublisherStub.callCount).to.eql(0)
        })

        it('returns an error message', () => {
          expect(result).to.eql({
            status: 'ERROR',
            error: 'db error!',
            request: {
              phoneNumber,
              name,
              publishers,
            },
          })
        })
      })

      describe('when updating phone number fails', () => {
        let result
        beforeEach(async () => {
          createChannelStub.callsFake(() => Promise.reject(new Error('db error!')))
          result = await create({ db, sock, phoneNumber, name, publishers })
        })

        it('does not send welcome messages', () => {
          expect(welcomePublisherStub.callCount).to.eql(0)
        })

        it('returns an error message', () => {
          expect(result).to.eql({
            status: 'ERROR',
            error: 'db error!',
            request: {
              phoneNumber,
              name,
              publishers,
            },
          })
        })
      })
    })

    describe('when subscribing to signal messages fails', () => {
      let result
      beforeEach(async () => {
        subscribeStub.callsFake(() => Promise.reject(new Error('oh noes!')))
        result = await create({ db, sock, phoneNumber, name, publishers })
      })

      it('does not create channel record', () => {
        expect(createChannelStub.callCount).to.eql(0)
      })

      it('does not update phone number record', () => {
        expect(updatePhoneNumberStub.callCount).to.eql(0)
      })

      it('does not send welcome messages', () => {
        expect(welcomePublisherStub.callCount).to.eql(0)
      })

      it('returns an error message', () => {
        expect(result).to.eql({
          status: 'ERROR',
          error: 'oh noes!',
          request: {
            phoneNumber,
            name,
            publishers,
          },
        })
      })
    })
  })
})
