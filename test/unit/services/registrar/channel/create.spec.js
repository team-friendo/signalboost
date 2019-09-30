import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../../../../app/db/repositories/channel'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import signal from '../../../../../app/services/signal'
import messenger from '../../../../../app/services/dispatcher/messenger'
import { create, welcomeNotification } from '../../../../../app/services/registrar/channel/create'
import { addPublisher } from '../../../../../app/services/registrar/channel'
import { genPhoneNumber } from '../../../../support/factories/phoneNumber'

describe('channel creation module', () => {
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

  let addPublisherStub, createChannelStub, subscribeStub, updatePhoneNumberStub, notifyStub

  beforeEach(() => {
    addPublisherStub = sinon.stub(channelRepository, 'addPublisher')
    createChannelStub = sinon.stub(channelRepository, 'create')
    subscribeStub = sinon.stub(signal, 'subscribe')
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    notifyStub = sinon.stub(messenger, 'notify')
  })

  afterEach(() => {
    addPublisherStub.restore()
    createChannelStub.restore()
    subscribeStub.restore()
    updatePhoneNumberStub.restore()
    notifyStub.restore()
  })

  describe('creating a channel', () => {
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
        const successStatus = { status: 'SUCCESS', message: 'success!' }
        beforeEach(() => notifyStub.returns(Promise.resolve(successStatus)))

        it('returns a success status', async () => {
          expect(await addPublisher({ db, sock, channelPhoneNumber, publisherPhoneNumber })).to.eql(
            successStatus,
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
})
