const channelRepository = require('./db/repositories/channel')
const metrics = require('./metrics')
const { gauges } = metrics
const { times, isEmpty } = require('lodash')
const { MinHeap } = require('mnemonist/heap')
const {
  socket: { availableSockets },
} = require('./config')

// () => Promise<Array<number>>
const assignChannelsToSockets = async () => {
  // Get channels along with their member counts, sorted in descending order by member count
  const channelsWithSizes = await channelRepository.getChannelsSortedBySize()
  // Distribute channels as evenly as possible by member count across available socket pools
  const channelsInBuckets = groupEvenlyBySize(channelsWithSizes, availableSockets)
  // Create socket pool assignments (and log them so maintainers can create more pools if needed)
  return Promise.all(
    channelsInBuckets.map(({ channelPhoneNumbers, maxMemberCount, totalMemberCount }, socketId) => {
      metrics.setGauge(gauges.SOCKET_POOL_NUM_CHANNELS, channelPhoneNumbers.length, [socketId])
      metrics.setGauge(gauges.SOCKET_POOL_NUM_MEMBERS, totalMemberCount, [socketId])
      metrics.setGauge(gauges.SOCKET_POOL_LARGEST_CHANNEL, maxMemberCount, [socketId])
      return channelRepository.updateSocketIds(channelPhoneNumbers, socketId)
    }),
  )
}

// (Tuple<string,number>, number) =>
//   Array<channelPhoneNumbers: Array<string>, totalMemberCount: number, maxMemberCount: number}>
const groupEvenlyBySize = (channelsWithSizes, numBuckets) => {
  // Iterate over all channels, and on each iteration, add the channel under consideration
  // into the bucket with least members, producing an even-as-possible distribution
  // of channel-members across a fixed number of buckets.
  const buckets = MinHeap.from(
    times(numBuckets, () => ({
      channelPhoneNumbers: [],
      totalMemberCount: 0,
      maxMemberCount: 0,
    })),
    (a, b) => a.totalMemberCount - b.totalMemberCount,
  )
  channelsWithSizes.forEach(([channelPhoneNumber, memberCount]) => {
    const { channelPhoneNumbers, totalMemberCount, maxMemberCount } = buckets.pop()
    buckets.push({
      channelPhoneNumbers: channelPhoneNumbers.concat(channelPhoneNumber),
      totalMemberCount: totalMemberCount + memberCount,
      // The first memberCount will always be the largest b/c we sorted
      // channelsWithSizes in descending order of size in our db query.
      maxMemberCount: isEmpty(channelPhoneNumbers) ? memberCount : maxMemberCount,
    })
  })
  return buckets.consume()
}

module.exports = { assignChannelsToSockets, groupEvenly: groupEvenlyBySize }
