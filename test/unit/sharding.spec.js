import { expect } from 'chai'
import sinon from 'sinon'
import { describe, it, beforeEach, afterEach } from 'mocha'
import {
  groupEvenly,
  groupIntoSizedBuckets,
  groupIntoTiers,
  shardChannels,
} from '../../app/sharding'
import channelRepository from '../../app/db/repositories/channel'

describe('sharding module', () => {
  /*************************
   * here we represent channels as a list of tuples
   * where first tuple is an integer string standing in for the channel's "phoneNumber"
   * and the second is an integer representing its number of members
   ************************/
  const channelsWithSizes = [
    ['0', 1000],
    ['1', 200],
    ['2', 200],
    ['3', 100],
    ['4', 55],
    ['5', 54],
    ['6', 53],
    ['7', 52],
    ['8', 51],
    ['9', 50],
    ['10', 10],
    ['11', 9],
    ['12', 8],
    ['13', 7],
    ['14', 6],
    ['15', 5],
    ['16', 4],
    ['17', 3],
    ['18', 2],
    ['19', 1],
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
          [['0'], 0], // ???
          [['1', '2', '3'], 1],
          [['4', '5', '6', '7', '8', '9'], 2],
          [['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'], 3],
        ])
      })
      it('records sharding results in a prometheus gauge')
    })
    describe('when bucketing strategy yields more buckets than available pools', () => {
      beforeEach(() =>
        // this will cause bucketing strategy to yield 7 buckets, which is 1 greater than available pools
        getChannelsSortedBySizeStub.returns(Promise.resolve([['-1', 10001], ...channelsWithSizes])),
      )
      it('assigns channels to socket pools using a tiering strategy', async () => {
        await shardChannels()
        const updateCallArgs = updateSocketPoolsStub.getCalls().map(call => call.args)
        expect(updateCallArgs).to.have.deep.members([
          [['-1', '0'], 0], // ???
          [['1', '2', '3'], 1],
          [['4', '5', '6', '7', '8', '9'], 2],
          [['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'], 3],
        ])
      })
      it('records sharding results in a prometheus gauge')
    })
  })

  describe('channel-grouping strategies', () => {
    describe('#groupEvenly', () => {
      it('groups channels as evenly as possible into a fixed number of buckets', () => {
        expect(groupEvenly(channelsWithSizes, 5)).to.eql([
          {
            phoneNumbers: ['3', '6', '8', '12', '16'],
            subscribers: 216, // 100 + 53 + 51 + 8 + 4
          },
          {
            phoneNumbers: ['4', '5', '7', '9', '15', '19'],
            subscribers: 217, // 55 + 54 + 52 + 50 + 5 + 1
          },
          {
            phoneNumbers: ['2', '10', '14', '18'],
            subscribers: 218, // 200 + 10 + 6 + 2
          },
          {
            phoneNumbers: ['1', '11', '13', '17'],
            subscribers: 219, // 200 + 9 + 7 + 3
          },
          {
            phoneNumbers: ['0'],
            subscribers: 1000,
          },
        ])
      })
    })

    describe('#groupIntoSizedBuckets', () => {
      it('groups channels into variable number of buckets with smallest possible # of subscribers >= a fixed size', () => {
        expect(groupIntoSizedBuckets(channelsWithSizes, 200)).to.eql([
          ['0'],
          ['1'],
          ['2'],
          ['3', '4', '5'],
          ['6', '7', '8', '9'],
          ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'],
        ])
      })
    })

    describe('#groupIntoTiers', () => {
      it("groups channels into fixed number of tiers based on each channel's subscriber size", () => {
        expect(groupIntoTiers(channelsWithSizes, [250, 100, 50, 0])).to.eql([
          ['0'],
          ['1', '2', '3'],
          ['4', '5', '6', '7', '8', '9'],
          ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'],
        ])
      })
    })
  })
})
