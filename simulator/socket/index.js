const { createPool } = require('generic-pool')
const callbacks = require('../callbacks')
const net = require('net')
const fs = require('fs-extra')
const { wait, loggerOf } = require('../../app/util')
const {
  socket: { connectionInterval, maxConnectionAttempts, poolSize },
} = require('../../app/config')

// CONSTANTS

const logger = loggerOf('socket')
const SIGNALD_SOCKET_PATH = '/signalboost/sock/signald.sock'
const messages = {
  error: {
    socketTimeout: 'Maximum signald connection attempts exceeded.',
    socketConnectError: reason => `Failed to connect to signald socket; Reason: ${reason}`,
  },
}

// STARTUP

// () => Promise<Pool>
const run = async () => {
  logger.log('Initializing socket pool...')
  const pool = await socketPoolOf({ create: getSocketConnection, destroy: destroySocketConnection })
  logger.log(`...initialized pool of ${pool.size} sockets.`)
  return pool
}

/* ({ create: () => Socket, destroy: () => void}) -> Promise<void> */
const socketPoolOf = async ({ create, destroy }) => {
  const pool = await createPool({ create, destroy }, { min: poolSize, max: poolSize })
  pool.stop = () => pool.drain().then(() => pool.clear())
  return pool
}

// number -> Promise<Socket>
const getSocketConnection = async (attempts = 0) => {
  if (!(await fs.pathExists(SIGNALD_SOCKET_PATH))) {
    if (attempts > maxConnectionAttempts) {
      return Promise.reject(new Error(messages.error.socketTimeout))
    } else {
      return wait(connectionInterval).then(() => getSocketConnection(attempts + 1))
    }
  } else {
    return connect()
  }
}

// () -> Promise<Socket>
const connect = () => {
  try {
    const sock = net.createConnection(SIGNALD_SOCKET_PATH)
    sock.setEncoding('utf8')
    sock.setMaxListeners(0) // removes ceiling on number of listeners (useful for `await` handlers below)
    sock.on('data', data => {
      if (process.env.SIGNALBOOST_VERBOSE_LOG === '1') logger.log(data)
      data
        .split('\n')
        .filter(Boolean)
        .forEach(msg => {
          try {
            callbacks.handle(JSON.parse(msg))
          } catch (e) {
            logger.error('Failed to parse msg: ', msg)
          }
        })
    })
    return new Promise(resolve => sock.on('connect', () => resolve(sock)))
  } catch (e) {
    return Promise.reject(new Error(messages.error.socketConnectError(e.message)))
  }
}

// Socket -> void
const destroySocketConnection = sock => sock.destroy()

module.exports = {
  run,
  getSocketConnection,
  destroySocketConnection,
  socketPoolOf,
}
