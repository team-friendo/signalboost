import { channelFactory } from './factories/channel'
import { sdMessageOf } from '../../app/services/dispatcher/messenger'

export const emitMessage = (sock, msg, channel = channelFactory()) =>
  sock.emit('data', JSON.stringify(sdMessageOf(channel, msg)))
