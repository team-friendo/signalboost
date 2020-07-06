import { channelFactory } from './factories/channel'
import { sdMessageOf } from '../../app/signal'

export const emitMessage = (sock, msg, channel = channelFactory()) =>
  sock.emit('data', JSON.stringify(sdMessageOf(channel, msg)))
