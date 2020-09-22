const channelRepository = require('./db/repositories/channel')
const { times } = require('lodash')
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
  const initialState = times(numBuckets, () => ({ phoneNumbers: [], subscribers: 0 }))
  // Maintain invariant that first bucket always has the least subscdribers.
  // On each iteration, add the channel under consideration into the bucket with least subscribers.
  // NOTE: sorting incurs time complexity of O(N log N) where N is number of buckets. Since num buckets
  // is fixed at ~10 that seems fine. In the future we could use a min-heap to cut to O(log N).
  return channelsWithSizes.reduce(
    (buckets, [phoneNumber, subscribers]) =>
      [
        {
          phoneNumbers: buckets[0].phoneNumbers.concat(phoneNumber),
          subscribers: buckets[0].subscribers + subscribers,
        },
        ...buckets.slice(1),
      ].sort((a, b) => a.subscribers - b.subscribers),
    initialState,
  )
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
