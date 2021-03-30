const app = require('../app')
const { take, flatten, map } = require('lodash')
const {
  botPhoneNumbers,
  channelSizes,
  signalcPhoneNumbers,
  signaldPhoneNumbers,
} = require('./constants')

const createChannel = phoneNumber => app.db.channel.create({ phoneNumber })
const createMemberships = numMemberships =>
  Promise.all(
    flatten(
      map(take(botPhoneNumbers, numMemberships), memberPhoneNumber =>
        map(signalcPhoneNumbers.concat(signaldPhoneNumbers), channelPhoneNumber =>
          app.db.channel.create({
            channelPhoneNumber,
            memberPhoneNumber,
          }),
        ),
      ),
    ),
  )

;(async () => {
  await app.run({})
  await Promise.all([
    Promise.all(signalcPhoneNumbers.map(createChannel)),
    Promise.all(signaldPhoneNumbers.map(createChannel)),
    Promise.all(channelSizes.map(createMemberships)),
  ])
})()
