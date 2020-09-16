import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import sinon from 'sinon'
import channelRepository from '../../app/db/repositories/channel'
import metrics, { gauges } from '../../app/metrics'
import signal from '../../app/signal'
import notifier from '../../app/notifier'
import { times, zip, flatten, map } from 'lodash'
import { respondToHealthcheck, sendHealthchecks, failedHealthchecks } from '../../app/diagnostics'
import { channelFactory, deepChannelFactory } from '../support/factories/channel'
import { sdMessageOf } from '../../app/signal/constants'
const {
  signal: { diagnosticsPhoneNumber },
} = require('../../app/config')

describe('diagnostics module', () => {
  const channels = times(3, channelFactory)
  const channelPhoneNumbers = channels.map(ch => ch.phoneNumber)
  const diagnosticsChannel = deepChannelFactory({ phoneNumber: diagnosticsPhoneNumber })
  const responseTimes = [-1, -1, 2]
  let setGaugeStub, sendMessageStub, notifyMaintainersStub, healthcheckStub

  beforeEach(() => {
    failedHealthchecks.add(channels[0].phoneNumber)
    sinon
      .stub(channelRepository, 'findAll')
      .returns(Promise.resolve([...channels, diagnosticsChannel]))
    sinon.stub(channelRepository, 'findDeep').returns(Promise.resolve(diagnosticsChannel))
    setGaugeStub = sinon.stub(metrics, 'setGauge').returns(Promise.resolve())
    sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve(42))
    notifyMaintainersStub = sinon
      .stub(notifier, 'notifyMaintainers')
      .returns(Promise.resolve(['1', '2', '3']))
    healthcheckStub = sinon.stub(signal, 'healthcheck')
  })
  afterEach(() => {
    failedHealthchecks.clear()
    sinon.restore()
  })

  describe('sending a healthcheck', () => {
    beforeEach(async () => {
      responseTimes.forEach((responseTime, idx) =>
        healthcheckStub.onCall(idx).returns(responseTimes[idx]),
      )
      await sendHealthchecks()
    })

    it('sends a health check to all channels from diagnostics number', async () => {
      channelPhoneNumbers.forEach((channelPhoneNumber, idx) =>
        expect(healthcheckStub.getCall(idx).args[0]).to.eql(channelPhoneNumber),
      )
    })

    it("sets a gauge for each channel's response time", () => {
      zip(channelPhoneNumbers, responseTimes).forEach(([channelPhoneNumber, responseTime], idx) => {
        expect(setGaugeStub.getCall(idx).args).to.eql([
          gauges.CHANNEL_HEALTH,
          responseTime,
          [channelPhoneNumber],
        ])
      })
    })

    it('caches when channel fails first healtcheck', () => {
      expect(failedHealthchecks).to.contain(channels[1].phoneNumber)
    })

    it('alerts maintainers when a channel fails its second consecutive healthcheck', () => {
      // note: channels[1] also failed healtcheck, but we don't alert about it
      expect(flatten(map(notifyMaintainersStub.getCalls(), 'args'))).to.eql([
        `Channel ${channelPhoneNumbers[0]} failed to respond to healthcheck`,
      ])
    })
  })

  describe('responding to a healthcheck', () => {
    it('responds to the diagnostics number with id of incoming healthcheck', async () => {
      await respondToHealthcheck(channelPhoneNumbers[0], '1312')
      expect(sendMessageStub.callCount).to.eql(1)
      expect(sendMessageStub.getCall(0).args).to.eql([
        diagnosticsPhoneNumber,
        sdMessageOf({ phoneNumber: channelPhoneNumbers[0] }, `healthcheck_response 1312`),
      ])
    })
  })
})
