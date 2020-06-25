const app = require('./index')
const metrics = require('./metrics')
const { createPool } = require('generic-pool')
const net = require('net')
const fs = require('fs-extra')
const dispatcher = require('./dispatcher')
const callbacks = require('./dispatcher/callbacks')
const { promisifyCallback, wait, loggerOf, statuses } = require('./util.js')
const {
  socket: { connectionInterval, maxConnectionAttempts, poolSize },
} = require('./config')

// CONSTANTS

const logger = loggerOf('socket')
const SIGNALD_SOCKET_PATH = '/var/run/signald/signald.sock'
const messages = {
  error: {
    socketTimeout: 'Maximum signald connection attempts exceeded.',
    invalidJSON: msg => `Failed to parse JSON: ${msg}`,
    socketConnectError: reason => `Failed to connect to signald socket; Reason: ${reason}`,
  },
}

// STARTUP

// () => Promise<Pool>
const run = async () => {
  logger.log('Initializing socket pool...')
  const pool = await socketPoolOf({ create: getSocketConnection, destroy: x => x.destroy() })
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
    sock.on('data', msg => dispatcher.dispatch(msg).catch(logger.error))
    return new Promise(resolve => sock.on('connect', () => resolve(sock)))
  } catch (e) {
    return Promise.reject(new Error(messages.error.socketConnectError(e.message)))
  }
}

// object -> Promise<void>
const write = data =>
  new Promise((resolve, reject) =>
    app.socketPool
      .acquire()
      .then(sock =>
        sock.write(
          signaldEncode(data),
          promisifyCallback(
            () => {
              callbacks.register(sock, data)
              app.socketPool.release(sock)
              metrics.incrementCounter(metrics.counters.SIGNALD_MESSAGES, [
                data.type,
                data.username,
                metrics.messageDirection.OUTBOUND,
              ])
              return resolve()
            },
            e => {
              app.socketPool.release(sock)
              return reject({
                status: statuses.ERROR,
                message: `Error writing to signald socket: ${e.message}`,
              })
            },
          ),
        ),
      )
      .catch(reject),
  )

// object -> string
const signaldEncode = data => JSON.stringify(data) + '\n'

module.exports = {
  signaldEncode,
  run,
  write,
  getSocketConnection,
  socketPoolOf,
}
