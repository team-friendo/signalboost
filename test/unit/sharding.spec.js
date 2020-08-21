import { expect } from 'chai'
import sinon from 'sinon'
import { describe, it, beforeEach, afterEach } from 'mocha'
import { groupIntoBuckets, groupIntoTiers, shardChannels } from '../../app/sharding'
import channelRepository from '../../app/db/repositories/channel'

describe('sharding module', () => {
  /*************************
   * here we represent channels as a list of tuples
   * where first tuple is an integer string standing in for the channel's "phoneNumber"
   * and the second is an integer representing its number of members
   ************************/
  const channelsWithSizes = [
    ['0', 1000],
    ['1', 51],
    ['2', 50],
    ['3', 49],
    ['4', 48],
    ['5', 30],
    ['6', 21],
    ['7', 20],
    ['8', 18],
    ['9', 18],
    ['10', 10],
    ['11', 9],
    ['12', 5],
    ['13', 2],
    ['14', 1],
  ]
  let getChannelsSortedBySizeStub, updateSocketPoolsStub
  beforeEach(() => {
    getChannelsSortedBySizeStub = sinon.stub(channelRepository, 'getChannelsSortedBySize')

    updateSocketPoolsStub = sinon
      .stub(channelRepository, 'updateSocketPools')
      .returns(Promise.resolve())
  })
  afterEach(() => sinon.restore())

  describe('#shardChannels', () => {
    describe('when bucketing strategy yields fewer buckets than available socket pools', () => {
      beforeEach(() => getChannelsSortedBySizeStub.returns(Promise.resolve(channelsWithSizes)))

      it('assigns channels to socket pools using a bucketing strategy', async () => {
        await shardChannels()
        const updateCallArgs = updateSocketPoolsStub.getCalls().map(call => call.args)
        expect(updateCallArgs).to.have.deep.members([
          [['0'], 0],
          [['1'], 1],
          [['2'], 2],
          [['3', '4'], 3],
          [['5', '6'], 4],
          [['7', '8', '9'], 5],
          [['10', '11', '12', '13', '14'], 6],
        ])
      })
      it('records sharding results in a prometheus gauge')
    })
    describe('when bucketing strategy yields more buckets than available pools', () => {
      beforeEach(() =>
        // this will cause bucketing strategy to yield 8 buckets, which is 1 greater than available pools
        getChannelsSortedBySizeStub.returns(Promise.resolve([['-1', 10001], ...channelsWithSizes])),
      )
      it('assigns channels to socket pools using a tiering strategy', async () => {
        await shardChannels()
        const updateCallArgs = updateSocketPoolsStub.getCalls().map(call => call.args)
        expect(updateCallArgs).to.have.deep.members([
          [['-1', '0', '1', '2'], 0],
          [['3', '4', '5', '6', '7'], 1],
          [['8', '9', '10', '11', '12'], 2],
          [['13', '14'], 3],
        ])
      })
      it('records sharding results in a prometheus gauge')
    })
  })

  describe('channel-grouping strategies', () => {
    describe('#groupIntoBuckets', () => {
      it('groups channels into variable number of buckets with smallest possible # of subscribers >= a fixed size', () => {
        expect(groupIntoBuckets(channelsWithSizes, 50)).to.eql([
          ['0'],
          ['1'],
          ['2'],
          ['3', '4'],
          ['5', '6'],
          ['7', '8', '9'],
          ['10', '11', '12', '13', '14'],
        ])
      })
    })

    describe('#groupIntoTiers', () => {
      it("groups channels into fixed number of tiers based on each channel's subscriber size", () => {
        expect(groupIntoTiers(channelsWithSizes, [50, 20, 5, 0])).to.eql([
          ['0', '1', '2'],
          ['3', '4', '5', '6', '7'],
          ['8', '9', '10', '11', '12'],
          ['13', '14'],
        ])
      })
    })
  })
})
