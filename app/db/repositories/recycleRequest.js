const app = require('../../../app')

// (string) -> Promise<{ recycleRequest: RecycleRequest, wasCreated: boolean }>
const requestToRecycle = phoneNumber =>
  app.db.recycleRequest
    .findOrCreate({ where: { phoneNumber } })
    .then(([recycleRequest, wasCreated]) => ({
      recycleRequest,
      wasCreated,
    }))

/**
 * RECYCLING HELPER FUNCTIONS
 */
// const {
//   job: { recyclePhoneNumberInterval, recycleGracePeriod },
// } = require('../../config')

//
// // (String) -> Promise
// const dequeue = channelPhoneNumber =>
//   app.db.recycleRequest.destroy({ where: { channelPhoneNumber } })
//
// const recyclePhoneNumbers = async () => {
//   const recycleablePhoneNumbers = await app.db.recycleRequest.findAll({})
//   // get/await recycleablePhoneNumbers => messageCounts
//   // find messageCount based on channelPhoneNumber
//   // dequeue recycleableNumbers that were used within recycleDelay window
//   recycleablePhoneNumbers
//     .filter(usedRecently)
//     .forEach(async ({ channelPhoneNumber }) => await dequeue(channelPhoneNumber))
//
//   // recycle channel if enqueued before recycleDelay window
//   recycleablePhoneNumbers.filter(enqueuedAwhileAgo).forEach(async ({ channelPhoneNumber }) => {
//     await dequeue(channelPhoneNumber)
//     await recycle(channelPhoneNumber)
//   })
// }
//
// // (Object) -> boolean
// const enqueuedAwhileAgo = ({ createdAt }) => {
//   // difference between now and grace period
//   const recycleDelayWindow = moment().subtract(recycleGracePeriod)
//   return moment(createdAt).diff(recycleDelayWindow) < 0
// }
//
// // (Object) -> boolean
// const usedRecently = async ({ channelPhoneNumber }) => {
//   const channel = await channelRepository.findDeep(channelPhoneNumber)
//
//   const lastUsed = moment(channel.messageCount.updatedAt)
//   const recycleDelayWindow = moment().subtract(recycleGracePeriod)
//   return lastUsed.diff(recycleDelayWindow) > 0
// }

module.exports = { requestToRecycle }
