const { createPool } = require('generic-pool')
const net = require('net')
const fs = require('fs-extra')
const dispatcher = require('../dispatcher')
const { times } = require('lodash')
const { wait, loggerOf } = require('../util.js')
const {
  socket: { connectionInterval, maxConnectionAttempts, poolSize, availableSockets },
} = require('../config')

// CONSTANTS

const logger = loggerOf('socket')
const signaldSocketDir = '/var/run/signald-sockets'
const messages = {
  error: {
    socketTimeout: 'Maximum signald connection attempts exceeded.',
    socketConnectError: reason => `Failed to connect to signald socket; Reason: ${reason}`,
  },
}

// STARTUP

// () => Promise<Pool>
const run = async () => {
  logger.log('Initializing socket pools...')
  const pools = await Promise.all(
    times(availableSockets, socketPooldId =>
      socketPoolOf({
        create: () => getSocketConnection(socketPooldId),
        destroy: sock => sock.destroy(),
      }),
    ),
  )
  pools.stop = Promise.all(pools.map(p => p.stop()))
  logger.log(`...initialized ${pools.length} pools of ${pools[0].size} sockets.`)
  return pools
}

/* ({ create: () => Socket, destroy: () => void}) -> Promise<void> */
const socketPoolOf = async ({ create, destroy }) => {
  const pool = await createPool({ create, destroy }, { min: poolSize, max: poolSize })
  pool.run = run
  pool.stop = () => pool.clear()
  return pool
}

// (number, number) -> Promise<Socket>
const getSocketConnection = async (socketId, attempts = 0) => {
  const socketFilePath = `${signaldSocketDir}/${socketId}/signald.sock`
  if (!(await fs.pathExists(socketFilePath))) {
    if (attempts > maxConnectionAttempts) {
      return Promise.reject(new Error(messages.error.socketTimeout))
    } else {
      return wait(connectionInterval).then(() => getSocketConnection(socketId, attempts + 1))
    }
  } else {
    return connect(
      socketFilePath,
      socketId,
    )
  }
}

// (string, number) -> Promise<Socket>
const connect = (socketFilePath, socketId) => {
  try {
    const sock = net.createConnection(socketFilePath)
    sock.setEncoding('utf8')
    sock.setMaxListeners(0) // removes ceiling on number of listeners (useful for `await` handlers below)
    sock.on('data', dispatcher.dispatcherOf(socketId))
    return new Promise(resolve => sock.on('connect', () => resolve(sock)))
  } catch (e) {
    return Promise.reject(new Error(messages.error.socketConnectError(e.message)))
  }
}

module.exports = {
  run,
  getSocketConnection,
  socketPoolOf,
}
