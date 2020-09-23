const channelRepository = require('./db/repositories/channel')
const { times } = require('lodash')
const { MinHeap } = require('mnemonist/heap')
const {
  socket: { availablePools, subscribersPerSocket, tierThresholds },
} = require('./config')

const shardChannels = async () => {
  // Get channels along with their membership sizes, sorted in descending order by size
  const channelsWithSizes = await channelRepository.getChannelsSortedBySize()

  // Try to group channels into a variable number of buckets, each of which has the smallest
  // possible number of subscribers above a fixed bucket size. (Currently 1000).
  const channelsInBuckets = groupIntoSizedBuckets(channelsWithSizes, subscribersPerSocket)

  // If that results in more buckets than availabale socket pools, group channels into a fixed
  // number of tiers, with tiers determined by individual channel subscriber size.
  const channelsInTiers =
    channelsInBuckets.length >= availablePools && groupIntoTiers(channelsWithSizes, tierThresholds)

  // make db udpates (requires N queries, where N is number of pools we are sharding into)
  const shards = channelsInTiers || channelsInBuckets
  await Promise.all(
    shards.map((channelPhoneNumbers, idx) =>
      channelRepository.updateSocketPools(channelPhoneNumbers, idx),
    ),
  )
  // publish sharding strategy and shard count
  // (so sysadmins can adjust configs if bucketing fails or might soon fail)
  // metrics.setGauge(gauges.SHARDING_STRATEGY, channnelsInTiers ? 'tiers' : 'buckets')
  // metrics.setGauge(gauges.SHARD_COUNT, shardedChannels.length)
}

const groupEvenly = (channelsWithSizes, numBuckets) => {
  // Iterate over all channels, and on each iteration, add the channel under consideration
  // into the bucket with least subscribers, producing an even-as-possible distribution
  // of channel-subscribers across a fixed number of buckets.
  const buckets = MinHeap.from(
    times(numBuckets, () => ({ phoneNumbers: [], subscribers: 0 })),
    (a, b) => a.subscribers - b.subscribers,
  )
  channelsWithSizes.forEach(([phoneNumber, subscriberCount]) => {
    const { phoneNumbers, subscribers } = buckets.pop()
    buckets.push({
      phoneNumbers: phoneNumbers.concat(phoneNumber),
      subscribers: subscribers + subscriberCount,
    })
  })
  return buckets.consume()
}

const groupIntoSizedBuckets = (itemsWithSizes, bucketSize) => {
  const initialState = { buckets: [[]], bucketLevel: 0 }

  return itemsWithSizes.reduce(({ buckets, bucketLevel }, [item, size]) => {
    return bucketLevel >= bucketSize
      ? // no more room in the bucket! make a new bucket and reset the level counter!
        {
          buckets: [...buckets, [item]],
          bucketLevel: size,
        }
      : // there's room! add this item to the current bucket and increment the counter by its size!
        {
          buckets: [...buckets.slice(0, -1), [...buckets.slice(-1)[0], item]],
          bucketLevel: bucketLevel + size,
        }
  }, initialState).buckets
}

const groupIntoTiers = (itemsWithSizes, _tierThresholds) => {
  _tierThresholds.sort((a, b) => b - a) // ensure thresholds are in descending order
  const initialState = { tiers: [[]], thresholdIdx: 0 }

  return itemsWithSizes.reduce(({ tiers, thresholdIdx }, [item, size]) => {
    return size >= _tierThresholds[thresholdIdx]
      ? {
          // item size is above the current threshold! plop it in current tier & maintain threshold!
          tiers: [...tiers.slice(0, -1), [...tiers.slice(-1)[0], item]],
          thresholdIdx,
        }
      : {
          // item size is below the current threshold! plop it in next tier and lower the threshold!
          tiers: [...tiers, [item]],
          thresholdIdx: thresholdIdx + 1,
        }
  }, initialState).tiers
}

module.exports = { shardChannels, groupEvenly, groupIntoSizedBuckets, groupIntoTiers }
