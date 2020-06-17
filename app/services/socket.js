const genericPool = require('generic-pool')
const net = require('net')
const fs = require('fs-extra')
const { promisifyCallback, wait } = require('./util.js')
const { statuses } = require('../services/util')
const {
  signal: { connectionInterval, maxConnectionAttempts, poolMinConnections, poolMaxConnections },
} = require('../config')

// CONSTANTS

const SIGNALD_SOCKET_PATH = '/var/run/signald/signald.sock'

const messages = {
  error: {
    socketTimeout: 'Maximum signald connection attempts exceeded.',
    invalidJSON: msg => `Failed to parse JSON: ${msg}`,
    socketConnectError: reason => `Failed to connect to signald socket; Reason: ${reason}`,
  },
}

const getSocket = async (attempts = 0) => {
  if (!(await fs.pathExists(SIGNALD_SOCKET_PATH))) {
    if (attempts > maxConnectionAttempts) {
      return Promise.reject(new Error(messages.error.socketTimeout))
    } else {
      return wait(connectionInterval).then(() => getSocket(attempts + 1))
    }
  } else {
    return connect()
  }
}

const connect = () => {
  try {
    const sock = net.createConnection(SIGNALD_SOCKET_PATH)
    sock.setEncoding('utf8')
    sock.setMaxListeners(0) // removes ceiling on number of listeners (useful for `await` handlers below)
    // sock.on('data', handleSocketMessage)
    return new Promise(resolve => sock.on('connect', () => resolve(sock)))
  } catch (e) {
    return Promise.reject(new Error(messages.error.socketConnectError(e.message)))
  }
}

const write = (sock, data) =>
  new Promise((resolve, reject) =>
    sock.write(
      signaldEncode(data),
      promisifyCallback(resolve, e =>
        reject({
          status: statuses.ERROR,
          message: `Error writing to signald socket: ${e.message}`,
        }),
      ),
    ),
  )

const writeWithPool = async data => {
  new Promise((resolve, reject) =>
    pool
      .acquire()
      .then(sock =>
        sock.write(
          signaldEncode(data),
          promisifyCallback(
            () => {
              pool.release(sock)
              return resolve()
            },
            e => {
              pool.release(sock)
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
}

const pool = genericPool.createPool(
  {
    create: getSocket,
    destroy: socket => socket.destroy(),
  },
  {
    min: poolMinConnections,
    max: poolMaxConnections,
  },
)

const signaldEncode = data => JSON.stringify(data) + '\n'

module.exports = {
  signaldEncode,
  getSocket,
  writeWithPool,
  write,
  pool,
}
