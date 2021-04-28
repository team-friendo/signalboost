const poolFactory = require('generic-pool')
const net = require('net')
const fs = require('fs-extra')
const dispatcher = require('./dispatcher')
const metrics = require('./metrics')
const {
  counters: { SIGNALD_MESSAGES },
  messageDirection: { OUTBOUND },
} = metrics
const { times } = require('lodash')
const util = require('./util.js')
const { emphasize, promisifyCallback, redact, statuses, wait } = util
const {
  socket: {
    awaitCloseInterval,
    awaitCloseMaxAttempts,
    connectionInterval,
    maxConnectionAttempts,
    poolSize,
    availableSockets,
  },
} = require('./config')

// CONSTANTS

const logger = util.loggerOf('socket')
const socketDir = '/signalboost/sockets'
const messages = {
  error: {
    socketTimeout: 'Maximum signald connection attempts exceeded.',
    socketConnectError: reason => `Failed to connect to signald socket; Reason: ${reason}`,
  },
}

// STARTUP

// () => Promise<Pool>
const run = async () => {
  logger.log('Initializing socket connection pools...')
  const pools = await createNConnectionPools(availableSockets, getConnection, closeConnection)
  logger.log(`...initialized ${pools.length} pools of ${pools[0].size} sockets.`)
  return pools
}

const createNConnectionPools = async (n, createPool, destroyPool) => {
  const pools = await Promise.all(times(n, _n => createConnectionPool(_n, createPool, destroyPool)))
  return {
    ...pools,
    awaitClose,
    stop: () => Promise.all(pools.map(p => p.stop())),
    stopSocket: socketId => (pools[socketId] ? pools[socketId].stop() : Promise.resolve()),
    restartSocket: async socketId =>
      (pools[socketId] = await createConnectionPool(socketId, getConnection, closeConnection)),
    size: socketId => pools[socketId].size,
    write: (data, socketId) => (pools[socketId] ? pools[socketId].write(data) : Promise.resolve()),
  }
}

// string => Promise<Pool<Socket>>
const createConnectionPool = async (socketId, createPool, destroyPool) => {
  const pool = await poolFactory.createPool(
    {
      create: () => createPool(socketId),
      destroy: sock => destroyPool(sock),
    },
    {
      min: poolSize,
      max: poolSize,
    },
  )

  pool.socketId = socketId
  pool.write = data => writeTo(pool, data)
  pool.stop = () => {
    pool._config.min = 0
    return pool.clear()
  }

  return pool
}

// (number, number) -> Promise<Socket>
const getConnection = async (socketId, attempts = 0) => {
  const socketFilePath = `${socketDir}/${socketId}/signald.sock`
  if (!(await fs.pathExists(socketFilePath))) {
    if (attempts > maxConnectionAttempts) {
      return Promise.reject(new Error(messages.error.socketTimeout))
    } else {
      return wait(connectionInterval).then(() => getConnection(socketId, attempts + 1))
    }
  } else {
    return connect(socketFilePath, socketId)
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

// Socket -> void
const closeConnection = connection => connection.destroy() // yes it's important to say `destroy` instead of `close`!

const writeTo = (pool, data) => {
  const id = util.genUuid()
  const msg = JSON.stringify({ ...data, id }) + '\n'
  return new Promise((resolve, reject) =>
    pool
      .acquire()
      .then(sock => {
        return sock.write(
          msg,
          promisifyCallback(
            () => {
              pool.release(sock)
              logger.debug(emphasize(`[socket ${pool.socketId}]\n${redact(msg)}`))

              const type = (data.messageBody || '').includes('healthcheck')
                ? 'healthcheck'
                : data.type
              metrics.incrementCounter(SIGNALD_MESSAGES, [type, data.username, OUTBOUND])

              return resolve(id)
            },
            e => {
              pool.release(sock)
              return reject({
                status: statuses.ERROR,
                message: `Error writing message ${id}: ${e.message}`,
              })
            },
          ),
        )
      })
      .catch(reject),
  )
}

// (number, number) -> Promise<Boolean>
const awaitClose = async (socketId, attempts = 0) => {
  const socketFilePath = `${socketDir}/${socketId}/signald.sock`
  if (attempts > awaitCloseMaxAttempts) return Promise.reject('Socket closure timed out.')
  if (await fs.pathExists(socketFilePath)) {
    await wait(awaitCloseInterval)
    return awaitClose(socketId, attempts + 1)
  }
  return Promise.resolve(true)
}

module.exports = {
  run,
  awaitClose,
  createNConnectionPools,
  createConnectionPool,
  getConnection,
  writeTo,
}
