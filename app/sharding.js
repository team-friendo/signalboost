const channelRepository = require('./db/repositories/channel')
const { times } = require('lodash')
const { MinHeap } = require('mnemonist/heap')
const {
  socket: { availablePools },
} = require('./config')

const shardChannels = async () => {
  // Get channels along with their member counts, sorted in descending order by member count
  const channelsWithSizes = await channelRepository.getChannelsSortedBySize()
  // Distribute channel members as evenly as possible across available socket pools
  const channelsInBuckets = groupEvenly(channelsWithSizes, availablePools)
  // Create socket pool assignments (and log them so maintainers can create more pools if needed)
  await Promise.all(
    channelsInBuckets.map(({ channelPhoneNumbers, memberCount }, idx) => {
      // metrics.setGauge(gauges.CHANNELS_IN_SOCKET_POOL, idx, channelPhoneNumbers.length)
      // metrics.setGauge(gauges.MEMBERS_IN_SOCKET_POOL, idx, memberCount)
      return channelRepository.updateSocketPools(channelPhoneNumbers, idx)
    }),
  )
}

const groupEvenly = (channelsWithSizes, numBuckets) => {
  // Iterate over all channels, and on each iteration, add the channel under consideration
  // into the bucket with least members, producing an even-as-possible distribution
  // of channel-members across a fixed number of buckets.
  const buckets = MinHeap.from(
    times(numBuckets, () => ({ channelPhoneNumbers: [], memberCount: 0 })),
    (a, b) => a.memberCount - b.memberCount,
  )
  channelsWithSizes.forEach(([channelPhoneNumber, _memberCount]) => {
    const { channelPhoneNumbers, memberCount } = buckets.pop()
    buckets.push({
      channelPhoneNumbers: channelPhoneNumbers.concat(channelPhoneNumber),
      memberCount: memberCount + _memberCount,
    })
  })
  return buckets.consume()
}

module.exports = { shardChannels, groupEvenly }
