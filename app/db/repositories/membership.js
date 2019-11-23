const { times } = require('lodash')
const { defaultLanguage } = require('../../config')

const memberTypes = {
  PUBLISHER: 'PUBLISHER',
  SUBSCRIBER: 'SUBSCRIBER',
  NONE: 'NONE',
}

const addPublishers = (db, channelPhoneNumber, publisherNumbers = []) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    Promise.all(publisherNumbers.map(num => addPublisher(db, channelPhoneNumber, num))),
  )

const addPublisher = (db, channelPhoneNumber, publisherPhoneNumber) =>
  // NOTE(aguestuser|2019-09-26):
  //  - it is EXTREMELY IMPORTANT that `#addPublisher` remain idempotent
  //  - due to signald peculiarities, lots of logic about detecting safety number changes for publishers
  //    and correctly (re)trusting their key material hangs off of this invariant. do not violate it! thx! :)
  db.publication
    .findOrCreate({ where: { channelPhoneNumber, publisherPhoneNumber } })
    .spread(x => x)

const removePublisher = (db, channelPhoneNumber, publisherPhoneNumber) =>
  db.publication.destroy({ where: { channelPhoneNumber, publisherPhoneNumber } })

const addSubscriber = async (db, channelPhoneNumber, subscriberPhoneNumber, language = defaultLanguage) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'subscribe human to', () =>
    db.subscription.create({ channelPhoneNumber, subscriberPhoneNumber, language }),
  )

const removeSubscriber = async (db, channelPhoneNumber, subscriberPhoneNumber) =>
  performOpIfChannelExists(db, channelPhoneNumber, 'unsubscribe human from', async () =>
    db.subscription.destroy({ where: { channelPhoneNumber, subscriberPhoneNumber } }),
  )

// TODO(aguestuser|2019-09-21): this would be easier with a memberships table instead of pub/sub tables!
const resolveSenderType = async (db, channelPhoneNumber, senderPhoneNumber) => {
  const [subscriberPhoneNumber, publisherPhoneNumber] = times(2, () => senderPhoneNumber)
  if (await db.publication.findOne({ where: { channelPhoneNumber, publisherPhoneNumber } })) {
    return Promise.resolve(memberTypes.PUBLISHER)
  }
  if (await db.subscription.findOne({ where: { channelPhoneNumber, subscriberPhoneNumber } })) {
    return Promise.resolve(memberTypes.SUBSCRIBER)
  }
  return Promise.resolve(memberTypes.NONE)
}

const resolveSenderLanguage = async (db, channelPhoneNumber, senderPhoneNumber, senderType) => {
  const [subscriberPhoneNumber, publisherPhoneNumber] = times(2, () => senderPhoneNumber)
  if (senderType === memberTypes.PUBLISHER) {
    return (await db.publication.findOne({ where: { channelPhoneNumber, publisherPhoneNumber } }))
      .language
  }
  if (senderType === memberTypes.SUBSCRIBER) {
    return (await db.subscription.findOne({ where: { channelPhoneNumber, subscriberPhoneNumber } }))
      .language
  }
  return defaultLanguage
}

// TODO(aguestuser|2019-11-18): would be easier with a memberships table!
// (Database, string, MemberType, string) -> Array<number>
const updateMemberLanguage = async (db, memberPhoneNumber, memberType, language) => {
  switch (memberType) {
    case memberTypes.PUBLISHER:
      return db.publication.update(
        { language },
        { where: { publisherPhoneNumber: memberPhoneNumber } },
      )
    case memberTypes.SUBSCRIBER:
      return db.subscription.update(
        { language },
        { where: { subscriberPhoneNumber: memberPhoneNumber } },
      )
    // random person
    default:
      return Promise.resolve([0])
  }
}

const isPublisher = (db, channelPhoneNumber, publisherPhoneNumber) =>
  db.publication.findOne({ where: { channelPhoneNumber, publisherPhoneNumber } }).then(Boolean)

const isSubscriber = (db, channelPhoneNumber, subscriberPhoneNumber) =>
  db.subscription.findOne({ where: { channelPhoneNumber, subscriberPhoneNumber } }).then(Boolean)

// HELPERS

const performOpIfChannelExists = async (db, channelPhoneNumber, opDescription, op) => {
  const ch = await db.channel.findOne({
    where: { phoneNumber: channelPhoneNumber },
    include: [{ model: db.subscription }],
  })
  return ch ? op(ch) : Promise.reject(`cannot ${opDescription} non-existent channel`)
}

module.exports = {
  addPublisher,
  addPublishers,
  addSubscriber,
  isPublisher,
  isSubscriber,
  removePublisher,
  removeSubscriber,
  resolveSenderType,
  resolveSenderLanguage,
  updateMemberLanguage,
  memberTypes,
}
