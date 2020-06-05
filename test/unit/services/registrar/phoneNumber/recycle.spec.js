/* eslint-disable no-unused-vars */
import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import phoneNumberService from '../../../../../app/services/registrar/phoneNumber/index'
import sinon from 'sinon'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import channelRepository from '../../../../../app/db/repositories/channel'
import signal from '../../../../../app/services/signal'

describe('phone number services -- recycle module', () => {
  const phoneNumbers = '+11111111111,+12222222222'
  let db = {}
  const sock = {}
  let updatePhoneNumberStub,
    broadcastMessageStub,
    findChannelStub,
    getMemberPhoneNumbersStub,
    getAdminPhoneNumbersStub,
    destroyChannelSpy

  beforeEach(() => {
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    broadcastMessageStub = sinon.stub(signal, 'broadcastMessage')
    findChannelStub = sinon.stub(channelRepository, 'findDeep')
    getMemberPhoneNumbersStub = sinon.stub(channelRepository, 'getMemberPhoneNumbers')
    getAdminPhoneNumbersStub = sinon.stub(channelRepository, 'getAdminPhoneNumbers')
    destroyChannelSpy = sinon.spy()
  })

  afterEach(() => {
    updatePhoneNumberStub.restore()
    broadcastMessageStub.restore()
    findChannelStub.restore()
    getMemberPhoneNumbersStub.restore()
    getAdminPhoneNumbersStub.restore()
  })

  const updatePhoneNumberSucceeds = () =>
    updatePhoneNumberStub.callsFake((_, phoneNumber, { status }) =>
      Promise.resolve({ phoneNumber, status }),
    )

  const updatePhoneNumberFails = () =>
    updatePhoneNumberStub.callsFake((_, _phoneNumber, { _status }) =>
      Promise.resolve({
        then: _ => {
          throw 'DB phoneNumber update failure'
        },
      }),
    )

  const destroyChannelSucceeds = () =>
    findChannelStub.callsFake((_, phoneNumber) =>
      Promise.resolve({ destroy: destroyChannelSpy, phoneNumber }),
    )

  const destroyChannelFails = () =>
    findChannelStub.callsFake((_, phoneNumber) =>
      Promise.resolve({
        destroy: () => {
          throw 'Failed to destroy channel'
        },
        phoneNumber,
      }),
    )

  const broadcastMessageSucceeds = () =>
    broadcastMessageStub.callsFake(async (sock, phoneNumbers, msg) => await Promise.resolve())

  const broadcastMessageFails = () =>
    broadcastMessageStub.callsFake(
      async (sock, phoneNumbers, msg) => await Promise.reject('Failed to broadcast message'),
    )

  describe('recycling phone numbers', () => {
    describe('when phone numbers do not exist in channels db', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(null))
      })

      it('returns a channel not found status', async () => {
        const response = await phoneNumberService.recycle({
          db,
          sock,
          phoneNumbers: phoneNumbers,
        })

        expect(response).to.eql([
          {
            message: 'Channel not found for +11111111111',
            status: 'ERROR',
          },
          {
            message: 'Channel not found for +12222222222',
            status: 'ERROR',
          },
        ])
      })
    })

    describe('when phone numbers do exist in channels db', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve({}))
      })

      describe('when notifying members of channel recycling fails', () => {
        beforeEach(async () => {
          await broadcastMessageFails()
        })

        it('returns a failed status', async () => {
          const response = await phoneNumberService.recycle({
            db,
            sock,
            phoneNumbers: phoneNumbers,
          })

          expect(response).to.eql([
            {
              message:
                'Failed to recycle channel for +11111111111. Error: Failed to broadcast message',
              status: 'ERROR',
            },
            {
              message:
                'Failed to recycle channel for +12222222222. Error: Failed to broadcast message',
              status: 'ERROR',
            },
          ])
        })
      })

      describe('when notifying members of channel recycling succeeds', () => {
        beforeEach(async () => {
          await broadcastMessageSucceeds()
        })

        describe('when the channel destruction succeeds', () => {
          beforeEach(() => {
            destroyChannelSucceeds()
          })

          describe('when the phoneNumber update succeeds', () => {
            beforeEach(() => {
              updatePhoneNumberSucceeds()
            })

            it('notifies the members of the channel of destruction', async () => {
              await phoneNumberService.recycle({
                db,
                sock,
                phoneNumbers: phoneNumbers,
              })

              expect(broadcastMessageStub.callCount).to.eql(2)
            })

            it('updates the phone number record to verified', async () => {
              await phoneNumberService.recycle({
                db,
                sock,
                phoneNumbers: phoneNumbers,
              })

              expect(updatePhoneNumberStub.getCall(0).args).to.eql([
                {},
                '+11111111111',
                {
                  status: 'VERIFIED',
                },
              ])
            })

            it('successfully destroys the channel', async () => {
              await phoneNumberService.recycle({
                db,
                sock,
                phoneNumbers: phoneNumbers,
              })

              expect(destroyChannelSpy.callCount).to.eql(2)
            })

            it('returns successful recycled phone number statuses', async () => {
              const response = await phoneNumberService.recycle({
                db,
                sock,
                phoneNumbers: phoneNumbers,
              })

              expect(response).to.eql([
                {
                  data: {
                    phoneNumber: '+11111111111',
                    status: 'VERIFIED',
                  },
                  status: 'SUCCESS',
                },
                {
                  data: {
                    phoneNumber: '+12222222222',
                    status: 'VERIFIED',
                  },
                  status: 'SUCCESS',
                },
              ])
            })
          })

          describe('when the phoneNumber status update fails', () => {
            beforeEach(() => {
              updatePhoneNumberFails()
            })

            it('returns a failed status', async () => {
              const response = await phoneNumberService.recycle({
                db,
                sock,
                phoneNumbers: phoneNumbers,
              })

              expect(response).to.eql([
                {
                  message:
                    'Failed to recycle channel for +11111111111. Error: DB phoneNumber update failure',
                  status: 'ERROR',
                },
                {
                  message:
                    'Failed to recycle channel for +12222222222. Error: DB phoneNumber update failure',
                  status: 'ERROR',
                },
              ])
            })
          })
        })
      })

      describe('when the channel destruction fails', () => {
        beforeEach(() => {
          destroyChannelFails()
          getAdminPhoneNumbersStub.returns(['+16154804259', '+12345678910'])
        })

        it('notifies the correct instance maintainers', async () => {
          await phoneNumberService.recycle({
            db,
            sock,
            phoneNumbers: phoneNumbers,
          })

          expect(broadcastMessageStub.getCall(2).args[1]).to.eql(['+16154804259', '+12345678910'])
        })

        it('notifies the instance maintainers with a channel failure message', async () => {
          await phoneNumberService.recycle({
            db,
            sock,
            phoneNumbers: phoneNumbers,
          })

          expect(broadcastMessageStub.getCall(2).args[2]).to.eql({
            messageBody: 'Failed to recycle channel for phone number: +11111111111',
            type: 'send',
            username: '+15555555555',
          })
        })

        it('returns a failed status', async () => {
          const response = await phoneNumberService.recycle({
            db,
            sock,
            phoneNumbers: phoneNumbers,
          })

          expect(response).to.eql([
            {
              message:
                'Failed to recycle channel for +11111111111. Error: Failed to destroy channel',
              status: 'ERROR',
            },
            {
              message:
                'Failed to recycle channel for +12222222222. Error: Failed to destroy channel',
              status: 'ERROR',
            },
          ])
        })
      })
    })
  })
})
