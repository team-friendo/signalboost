import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import app from '../../app'
import channelRepository from '../../app/db/repositories/channel'
import metrics, { gauges } from '../../app/metrics'
import signal from '../../app/signal'
import notifier from '../../app/notifier'
import { times, zip, map } from 'lodash'
import { respondToHealthcheck, sendHealthchecks, failedHealthchecks } from '../../app/diagnostics'
import { channelFactory, deepChannelFactory } from '../support/factories/channel'
import { sdMessageOf } from '../../app/signal/constants'
const {
  signal: { diagnosticsPhoneNumber },
} = require('../../app/config')

describe('diagnostics module', () => {
  const socketId = 4
  const channels = times(3, () => channelFactory({ socketId }))
  const channelPhoneNumbers = channels.map(ch => ch.phoneNumber)
  const diagnosticsChannel = deepChannelFactory({ phoneNumber: diagnosticsPhoneNumber })
  const stubHealthchecksWith = responseTimes =>
    responseTimes.forEach((responseTime, idx) =>
      healthcheckStub.onCall(idx).returns(responseTimes[idx]),
    )

  let setGaugeStub,
    sendMessageStub,
    notifyMaintainersStub,
    healthcheckStub,
    abortStub,
    isAliveStub,
    restartSocketStub,
    stopSocketStub,
    unsubscribeStub,
    subscribeStub

  beforeEach(() => {
    sinon
      .stub(channelRepository, 'findAll')
      .returns(Promise.resolve([...channels, diagnosticsChannel]))
    sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(diagnosticsChannel))
    sinon.stub(channelRepository, 'getSocketId').returns(Promise.resolve(socketId))
    sinon.stub(channelRepository, 'getChannelsOnSocket').returns(Promise.resolve(channels))
    setGaugeStub = sinon.stub(metrics, 'setGauge').returns(Promise.resolve())
    sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve(42))
    notifyMaintainersStub = sinon
      .stub(notifier, 'notifyMaintainers')
      .returns(Promise.resolve(['1', '2', '3']))
    healthcheckStub = sinon.stub(signal, 'healthcheck')
    abortStub = sinon.stub(signal, 'abort').returns(Promise.resolve('42'))
    // stopStub = sinon.stub(app, 'stop').returns(Promise.resolve())
    // runStub = sinon.stub(app, 'run').returns(Promise.resolve())
    subscribeStub = sinon.stub(signal, 'unsubscribe').returns(Promise.resolve('42'))
    unsubscribeStub = sinon.stub(signal, 'subscribe').returns(Promise.resolve('42'))
    stopSocketStub = sinon.stub(app, 'stopSocket').returns(Promise.resolve())
    restartSocketStub = sinon.stub(app, 'restartSocket').returns(Promise.resolve())
    isAliveStub = sinon.stub(signal, 'isAlive').returns(Promise.resolve('v0.0.1'))
  })

  afterEach(() => {
    failedHealthchecks.clear()
    sinon.restore()
  })

  describe('sending a healthcheck', () => {
    describe('in all cases', () => {
      const responseTimes = [42, 42, 42]
      beforeEach(async () => {
        stubHealthchecksWith(responseTimes)
        await sendHealthchecks()
      })

      it('sends a health check to all channels from diagnostics number', async () => {
        channelPhoneNumbers.forEach((channelPhoneNumber, idx) =>
          expect(healthcheckStub.getCall(idx).args[0]).to.eql(channelPhoneNumber),
        )
      })

      it("sets a gauge for each channel's response time", () => {
        zip(channelPhoneNumbers, responseTimes).forEach(
          ([channelPhoneNumber, responseTime], idx) => {
            expect(setGaugeStub.getCall(idx).args).to.eql([
              gauges.CHANNEL_HEALTH,
              responseTime,
              [channelPhoneNumber],
            ])
          },
        )
      })
    })

    describe('when channel fails its first healthcheck', () => {
      // channels[1] has not
      const responseTimes = [-1, 42, 42]
      beforeEach(async () => {
        stubHealthchecksWith(responseTimes)
        await sendHealthchecks()
      })

      it('caches the channel phone number', () => {
        expect(failedHealthchecks).to.contain(channels[0].phoneNumber)
      })

      it('does not attempt to restart signalboost or notify maintainers', () => {
        ;[abortStub, isAliveStub, stopSocketStub, restartSocketStub].forEach(stub =>
          expect(stub.callCount).to.eql(0),
        )
      })
    })

    describe('when channels fail to respond to 2 consecutive healthchecks', () => {
      const responseTimes = [-1, -1, 42]
      beforeEach(async () => {
        failedHealthchecks.add(channels[0].phoneNumber)
        failedHealthchecks.add(channels[1].phoneNumber)
        stubHealthchecksWith(responseTimes)
      })

      describe('when restart succeeds', () => {
        beforeEach(async () => {
          await sendHealthchecks()
        })

        it('notifies maintainers of restart attempt', () => {
          expect(notifyMaintainersStub.getCall(0).args).to.eql([
            `Restarting shard ${socketId} due to failed healthchecks on ${
              channels[0].phoneNumber
            },${channels[1].phoneNumber}.`,
          ])
        })

        it('restarts shard that experienced failure', () => {
          // assert we restart signald and socket pool for shard in which failure occurred
          ;[abortStub, isAliveStub, stopSocketStub, restartSocketStub].forEach(stub => {
            expect(stub.callCount).to.eql(1)
            expect(stub.getCall(0).args).to.eql([socketId])
          })
          // assert we resubscribe to all channels in shard
          ;[subscribeStub, unsubscribeStub].forEach(stub => {
            expect(stub.callCount).to.eql(3)
            expect(map(stub.getCalls(0), 'args')).to.have.deep.members([
              [channels[0].phoneNumber, socketId],
              [channels[1].phoneNumber, socketId],
              [channels[2].phoneNumber, socketId],
            ])
          })
        })

        it('notifies maintainers when restart succeeds', () => {
          expect(notifyMaintainersStub.getCall(1).args).to.eql([
            `Shard ${socketId} restarted successfully!`,
          ])
        })
      })

      describe('and restart fails', () => {
        beforeEach(async () => {
          isAliveStub.callsFake(() => Promise.reject('not alive!'))
          await sendHealthchecks()
        })

        it('notifies maintainers of restart attempt', () => {
          expect(notifyMaintainersStub.getCall(0).args[0]).to.contain('Restarting')
        })

        it('attempts to restart shard in which failure occured', () => {
          expect(isAliveStub.callCount).to.eql(1)
        })

        it('notifies maintainers of restart failure', () => {
          expect(notifyMaintainersStub.getCall(1).args).to.eql([
            'Failed to restart shard: not alive!',
          ])
        })
      })
    })
  })

  describe('responding to a healthcheck', () => {
    it('responds to the diagnostics number with id of incoming healthcheck', async () => {
      await respondToHealthcheck(channels[0], '1312')
      expect(sendMessageStub.callCount).to.eql(1)
      expect(sendMessageStub.getCall(0).args).to.eql([
        sdMessageOf({
          sender: channels[0].phoneNumber,
          recipient: diagnosticsPhoneNumber,
          message: `healthcheck_response 1312`,
        }),
        channels[0].socketId,
      ])
    })
  })
})
