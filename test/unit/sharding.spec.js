import { expect } from 'chai'
import sinon from 'sinon'
import { map } from 'lodash'
import { afterEach, beforeEach, describe, it } from 'mocha'
import { groupEvenly, shardChannels } from '../../app/sharding'
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

  afterEach(() => sinon.restore())

  describe('#shardChannels', () => {
    let updateSocketPoolsStub
    beforeEach(() => {
      sinon
        .stub(channelRepository, 'getChannelsSortedBySize')
        .returns(Promise.resolve(channelsWithSizes))
      updateSocketPoolsStub = sinon
        .stub(channelRepository, 'updateSocketPools')
        .returns(Promise.resolve())
    })

    it('assigns channels to socket pools using a bucketing strategy', async () => {
      await shardChannels()
      expect(map(updateSocketPoolsStub.getCalls(), 'args')).to.have.deep.members([
        [['3', '6', '8', '12', '16'], 0],
        [['4', '5', '7', '9', '15', '19'], 1],
        [['2', '10', '14', '18'], 2],
        [['1', '11', '13', '17'], 3],
        [['0'], 4],
      ])
    })
    it('records sharding results in a prometheus gauge')
  })

  describe('#groupEvenly', () => {
    it('groups channels as evenly as possible into a fixed number of buckets', () => {
      expect(groupEvenly(channelsWithSizes, 5)).to.eql([
        {
          channelPhoneNumbers: ['3', '6', '8', '12', '16'],
          memberCount: 216, // 100 + 53 + 51 + 8 + 4
        },
        {
          channelPhoneNumbers: ['4', '5', '7', '9', '15', '19'],
          memberCount: 217, // 55 + 54 + 52 + 50 + 5 + 1
        },
        {
          channelPhoneNumbers: ['2', '10', '14', '18'],
          memberCount: 218, // 200 + 10 + 6 + 2
        },
        {
          channelPhoneNumbers: ['1', '11', '13', '17'],
          memberCount: 219, // 200 + 9 + 7 + 3
        },
        {
          channelPhoneNumbers: ['0'],
          memberCount: 1000,
        },
      ])
    })
  })
})
