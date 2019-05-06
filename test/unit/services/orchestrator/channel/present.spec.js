import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import channelRepository from '../../../../../app/db/repositories/channel'
import channelService from '../../../../../app/services/channel'
import { deepChannelAttrs } from '../../../../support/factories/channel'

describe('channel presenters', () => {
  describe('list', () => {
    const channels = deepChannelAttrs.map(ch => ({
      ...ch,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    let dbListStub

    beforeEach(() => (dbListStub = sinon.stub(channelRepository, 'findAllDeep')))
    afterEach(() => dbListStub.restore())

    describe('when db fetch succeeds', () => {
      beforeEach(() => dbListStub.returns(Promise.resolve(channels)))

      it('presents a list of formatted phone numbers and a count', async () => {
        expect(await channelService.list({})).to.eql({
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
      beforeEach(() => dbListStub.callsFake(() => Promise.reject('oh noes!')))

      it('presents a list of phone numbers and a count', async () => {
        expect(await channelService.list({})).to.eql({
          status: 'ERROR',
          data: {
            error: 'oh noes!',
          },
        })
      })
    })
  })
})
