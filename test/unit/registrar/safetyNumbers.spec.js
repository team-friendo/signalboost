import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import { expect } from 'chai'
import { updateFingerprint } from '../../../app/registrar/safetyNumbers'
import signal from '../../../app/signal'
import channelRepository from '../../../app/db/repositories/channel'
import membershipRepository from '../../../app/db/repositories/membership'
const { memberTypes } = membershipRepository
import deauthorizationRepository from '../../../app/db/repositories/deauthorization'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { statuses } from '../../../app/util'
import { channelFactory } from '../../support/factories/channel'
import { messagesIn } from '../../../app/dispatcher/strings/messages'
import { defaultLanguage } from '../../../app/config'
import { sdMessageOf } from '../../../app/signal/constants'
import { adminMembershipFactory } from '../../support/factories/membership'

describe('safety numbers registrar module', () => {
  const channelPhoneNumber = genPhoneNumber()
  const memberPhoneNumber = genPhoneNumber()
  const otherAdminPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  const fingerprint =
    '05 45 8d 63 1c c4 14 55 bf 6d 24 9f ec cb af f5 8d e4 c8 d2 78 43 3c 74 8d 52 61 c4 4a e7 2c 3d 53 '
  const sdMessage = sdMessageOf({
    sender: channelPhoneNumber,
    recipient: memberPhoneNumber,
    message: 'Good morning!',
  })
  const updatableFingerprint = { channelPhoneNumber, memberPhoneNumber, fingerprint, sdMessage }

  let resolveMemberTypeStub, trustStub, sendMessageStub, removeMemberStub, createDeauthStub

  beforeEach(() => {
    resolveMemberTypeStub = sinon.stub(membershipRepository, 'resolveMemberType')
    trustStub = sinon.stub(signal, 'trust')
    sendMessageStub = sinon.stub(signal, 'sendMessage')
    removeMemberStub = sinon.stub(membershipRepository, 'removeMember')
    createDeauthStub = sinon.stub(deauthorizationRepository, 'create')

    sinon.stub(channelRepository, 'findDeep').returns(
      Promise.resolve(
        channelFactory({
          phoneNumber: channelPhoneNumber,
          memberships: [
            adminMembershipFactory({
              channelPhoneNumber,
              memberPhoneNumber: otherAdminPhoneNumbers[0],
            }),
            adminMembershipFactory({
              channelPhoneNumber,
              memberPhoneNumber: otherAdminPhoneNumbers[1],
            }),
          ],
        }),
      ),
    )
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('updating a fingerprint', () => {
    describe('for a subscriber', () => {
      beforeEach(() => resolveMemberTypeStub.returns(Promise.resolve(memberTypes.SUBSCRIBER)))

      it("attempts to trust the subscriber's new fingerprint", async () => {
        await updateFingerprint(updatableFingerprint).catch(a => a)
        expect(trustStub.getCall(0).args).to.eql([
          channelPhoneNumber,
          memberPhoneNumber,
          fingerprint,
        ])
      })

      describe('when trust operation succeeds', () => {
        beforeEach(() =>
          trustStub.returns(
            Promise.resolve({ status: statuses.SUCCESS, message: 'fake trust success msg' }),
          ),
        )

        it('attempts to resend the original message', async () => {
          await updateFingerprint(updatableFingerprint).catch(a => a)

          expect(sendMessageStub.getCall(0).args).to.eql([sdMessage])
        })

        describe('when resending the original message succeeds', () => {
          beforeEach(() => sendMessageStub.returns(Promise.resolve()))

          it('resolves with succes status', async () => {
            expect(await updateFingerprint(updatableFingerprint)).to.eql({
              status: statuses.SUCCESS,
              message: 'fake trust success msg',
            })
          })
        })

        describe('when resending fails', () => {
          beforeEach(() =>
            sendMessageStub.callsFake(() =>
              Promise.reject({
                status: statuses.ERROR,
                message: 'whoops',
              }),
            ),
          )

          it('rejects with error status', async () => {
            const err = await updateFingerprint(updatableFingerprint).catch(a => a)
            expect(err).to.eql({ status: statuses.ERROR, message: 'whoops' })
          })
        })
      })

      describe('when trust operation fails', () => {
        beforeEach(() =>
          trustStub.callsFake(() =>
            Promise.reject({
              status: statuses.ERROR,
              message: 'fake trust error message',
            }),
          ),
        )
        it('rejects with error status', async () => {
          const err = await updateFingerprint(
            channelPhoneNumber,
            memberPhoneNumber,
            sdMessage,
          ).catch(a => a)

          expect(err).to.eql({ status: statuses.ERROR, message: 'fake trust error message' })
        })
      })
    })
  })

  describe('for a rando -- with no IO errors', () => {
    beforeEach(() => {
      resolveMemberTypeStub.returns(Promise.resolve(memberTypes.NONE))
      trustStub.returns(
        Promise.resolve({ status: statuses.SUCCESS, message: 'fake trust success msg' }),
      )
      sendMessageStub.returns(Promise.resolve('42'))
    })
    it("trusts the rando's new fingerprint", async () => {
      await updateFingerprint(updatableFingerprint)
      expect(trustStub.getCall(0).args).to.eql([channelPhoneNumber, memberPhoneNumber, fingerprint])
    })
    it('resends the message', async () => {
      await updateFingerprint(updatableFingerprint)
      expect(sendMessageStub.getCall(0).args).to.eql([sdMessage])
    })

    it('resolves with a success status', async () => {
      expect(await updateFingerprint(updatableFingerprint)).to.eql({
        status: statuses.SUCCESS,
        message: 'fake trust success msg',
      })
    })
  })

  describe('for an admin', () => {
    beforeEach(() => resolveMemberTypeStub.returns(Promise.resolve(memberTypes.ADMIN)))

    it('attempts to remove a admin from a channel', async () => {
      await updateFingerprint(updatableFingerprint).catch(a => a)
      expect(removeMemberStub.getCall(0).args).to.eql([channelPhoneNumber, memberPhoneNumber])
    })

    describe('if removal succeeds', () => {
      beforeEach(() =>
        removeMemberStub.returns(
          Promise.resolve({
            status: statuses.SUCCESS,
            message: 'fake removal success message',
          }),
        ),
      )

      describe('if deauthorization succeeds', () => {
        beforeEach(() => createDeauthStub.returns(Promise.resolve(updatableFingerprint)))

        it('notifies all the other admins', async () => {
          await updateFingerprint(updatableFingerprint).catch(a => a)
          expect(sendMessageStub.callCount).to.eql(2)
          expect(sendMessageStub.getCall(0).args).to.eql([
            sdMessageOf({
              sender: channelPhoneNumber,
              recipient: otherAdminPhoneNumbers[0],
              message: messagesIn(defaultLanguage).notifications.deauthorization(memberPhoneNumber),
            }),
          ])
        })

        describe('if notification succeeds', () => {
          beforeEach(() => sendMessageStub.returns(Promise.resolve()))

          it('resolves with a success status', async () => {
            const res = await updateFingerprint(channelPhoneNumber, memberPhoneNumber)
            expect(res).to.eql({
              status: statuses.SUCCESS,
              message: 'fake removal success message',
            })
          })
        })

        describe('if notification fails', () => {
          beforeEach(() =>
            sendMessageStub.callsFake(() =>
              Promise.reject({
                status: statuses.ERROR,
                message: 'write failure',
              }),
            ),
          )

          it('rejects with an error', async () => {
            const err = await updateFingerprint(updatableFingerprint).catch(a => a)
            expect(err).to.eql({
              status: statuses.ERROR,
              message: `Error deauthorizing ${memberPhoneNumber} on ${channelPhoneNumber}: write failure`,
            })
          })
        })
      })

      describe('if deauthorization fails', () => {
        beforeEach(() => {
          createDeauthStub.callsFake(() => Promise.reject(new Error('oh noes!')))
        })
        it('rejects with an error', async () => {
          const err = await updateFingerprint(updatableFingerprint).catch(a => a)
          expect(err).to.eql({
            status: statuses.ERROR,
            message: `Error deauthorizing ${memberPhoneNumber} on ${channelPhoneNumber}: oh noes!`,
          })
        })
      })
    })

    describe('if removal fails', () => {
      beforeEach(() =>
        removeMemberStub.callsFake(() =>
          Promise.reject({
            status: statuses.ERROR,
            message: 'fake removal error message',
          }),
        ),
      )

      it('rejects with an error', async () => {
        const err = await updateFingerprint(updatableFingerprint).catch(a => a)
        expect(err).to.eql({
          status: statuses.ERROR,
          message: `Error deauthorizing ${memberPhoneNumber} on ${channelPhoneNumber}: fake removal error message`,
        })
      })
    })
  })
})
