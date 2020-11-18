import { times } from 'lodash'
import { deepChannelFactory } from './factories/channel'
const {
  signal: { diagnosticsPhoneNumber },
} = require('../../app/config')

export const destroyAllChannels = async db => {
  await db.destructionRequest.destroy({ where: {}, force: true })
  await db.membership.destroy({ where: {}, force: true })
  await db.messageCount.destroy({ where: {}, force: true })
  await db.hotlineMessage.destroy({
    where: {},
    force: true,
    truncate: true,
    restartIdentity: true,
  })
  await db.channel.destroy({ where: {}, force: true })
}

export const createChannels = async (db, n) => {
  const channels = await Promise.all(
    times(n, () =>
      db.channel.create(deepChannelFactory(), {
        include: [{ model: db.membership }],
      }),
    ),
  )
  const diagnosticsChannel = await db.channel.create(
    deepChannelFactory({ phoneNumber: diagnosticsPhoneNumber }),
    {
      include: [{ model: db.membership }],
    },
  )
  return [channels, diagnosticsChannel]
}
