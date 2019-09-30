import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../../../app/db/repositories/channel'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import signal from '../../../../app/services/signal'
import messenger from '../../../../app/services/dispatcher/messenger'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { deepChannelAttrs } from '../../../support/factories/channel'
import { statuses } from '../../../../app/constants'
import {
  welcomeNotification,
  create,
  addPublisher,
  list,
} from '../../../../app/services/registrar/channel'

describe('channel registrar', () => {
  const db = {}
  const sock = {}
  const phoneNumber = genPhoneNumber()
  const channelPhoneNumber = phoneNumber
  const name = '#blackops'
  const publishers = [genPhoneNumber(), genPhoneNumber()]
  const publisherPhoneNumber = publishers[0]
  const channelInstance = {
    phoneNumber,
    name,
    publications: [
      { channelPhoneNumber: phoneNumber, publisherPhoneNumber: publishers[0] },
      { channelPhoneNumber: phoneNumber, publisherPhoneNumber: publishers[1] },
    ],
  }
  const activePhoneNumberInstance = {
    phoneNumber,
    status: 'ACTIVE',
  }

  let addPublisherStub,
    createChannelStub,
    subscribeStub,
    updatePhoneNumberStub,
    notifyStub,
    findAllDeepStub

  beforeEach(() => {
    addPublisherStub = sinon.stub(channelRepository, 'addPublisher')
    createChannelStub = sinon.stub(channelRepository, 'create')
    subscribeStub = sinon.stub(signal, 'subscribe')
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    notifyStub = sinon.stub(messenger, 'notify')
    findAllDeepStub = sinon.stub(channelRepository, 'findAllDeep')
  })

  afterEach(() => {
    addPublisherStub.restore()
    createChannelStub.restore()
    subscribeStub.restore()
    updatePhoneNumberStub.restore()
    notifyStub.restore()
    findAllDeepStub.restore()
  })

  describe('#create', () => {
    beforeEach(() => {
      updatePhoneNumberStub.returns(Promise.resolve({ phoneNumber, status: 'ACTIVE' }))
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
          await create({ db, sock, phoneNumber, name, publishers, welcome: notifyStub })
          expect(notifyStub.getCall(0).args).to.eql([
            {
              db,
              sock,
              channel: {
                phoneNumber,
                name,
                publications: [
                  { channelPhoneNumber: phoneNumber, publisherPhoneNumber: publishers[0] },
                  { channelPhoneNumber: phoneNumber, publisherPhoneNumber: publishers[1] },
                ],
              },
              notification: welcomeNotification,
              recipients: publishers,
            },
          ])
        })

        describe('when sending welcome messages succeeds', () => {
          beforeEach(() => {
            notifyStub.returns(Promise.resolve())
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
            notifyStub.callsFake(() => Promise.reject(new Error('oh noes!')))
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
          expect(notifyStub.callCount).to.eql(0)
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
          expect(notifyStub.callCount).to.eql(0)
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
        expect(notifyStub.callCount).to.eql(0)
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

  describe('#addPublisher', () => {
    it('attempts to add a publisher to a channel', async () => {
      await addPublisher({ db, sock, channelPhoneNumber, publisherPhoneNumber })
      expect(addPublisherStub.getCall(0).args).to.eql([
        db,
        channelPhoneNumber,
        publisherPhoneNumber,
      ])
    })

    describe('when adding publisher succeeds', () => {
      beforeEach(() => addPublisherStub.returns(Promise.resolve()))

      it('attempts to send welcome message', async () => {
        await addPublisher({ db, sock, channelPhoneNumber, publisherPhoneNumber })
        expect(notifyStub.getCall(0).args).to.eql([
          {
            db,
            sock,
            channel: { phoneNumber: channelPhoneNumber },
            notification: welcomeNotification,
            recipients: [publisherPhoneNumber],
          },
        ])
      })

      describe('when welcome message succeeds', () => {
        beforeEach(() => notifyStub.returns(Promise.resolve()))

        it('returns a success status', async () => {
          expect(await addPublisher({ db, sock, channelPhoneNumber, publisherPhoneNumber })).to.eql(
            {
              status: statuses.SUCCESS,
              message: welcomeNotification,
            },
          )
        })
      })

      describe('when welcome message fails', () => {
        const errorStatus = { status: 'ERROR', message: 'error!' }
        beforeEach(() => notifyStub.callsFake(() => Promise.reject(errorStatus)))

        it('returns an error status', async () => {
          const err = await addPublisher({
            db,
            sock,
            channelPhoneNumber,
            publisherPhoneNumber,
          }).catch(e => e)
          expect(err).to.eql(errorStatus)
        })
      })
    })

    describe('when adding publisher fails', () => {
      const errorStatus = { status: 'ERROR', message: 'error!' }
      beforeEach(() => addPublisherStub.callsFake(() => Promise.reject(errorStatus)))
      it('returns an error status', async () => {
        const err = await addPublisher({
          db,
          sock,
          channelPhoneNumber,
          publisherPhoneNumber,
        }).catch(e => e)
        expect(err).to.eql(errorStatus)
      })
    })
  })

  describe('#list', () => {
    const channels = deepChannelAttrs.map(ch => ({
      ...ch,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    describe('when db fetch succeeds', () => {
      beforeEach(() => findAllDeepStub.returns(Promise.resolve(channels)))

      it('presents a list of formatted phone numbers and a count', async () => {
        expect(await list({})).to.eql({
          status: 'SUCCESS',
          data: {
            count: 2,
            channels: [
              {
                name: 'foo',
                phoneNumber: '+11111111111',
                publishers: 2,
                subscribers: 2,
                messageCount: { broadcastOut: 4, commandIn: 5 },
              },
              {
                name: 'bar',
                phoneNumber: '+19999999999',
                publishers: 1,
                subscribers: 1,
                messageCount: { broadcastOut: 100, commandIn: 20 },
              },
            ],
          },
        })
      })
    })

    describe('when db fetch fails', () => {
      beforeEach(() => findAllDeepStub.callsFake(() => Promise.reject('oh noes!')))

      it('presents a list of phone numbers and a count', async () => {
        expect(await list({})).to.eql({
          status: 'ERROR',
          data: {
            error: 'oh noes!',
          },
        })
      })
    })
  })
})
