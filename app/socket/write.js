const app = require('../../app')
const util = require('../util')
const { emphasize, redact } = util
const metrics = require('../metrics')
const { statuses, promisifyCallback } = require('../util')
const logger = util.loggerOf('socket.write')
const {
  counters: { SIGNALD_MESSAGES },
  messageDirection: { OUTBOUND },
} = metrics

// (object, number) -> Promise<void>
const write = (data, socketPoolId) => {
  const id = util.genUuid()
  const msg = JSON.stringify({ ...data, id }) + '\n'

  return new Promise((resolve, reject) =>
    app.socketPools[socketPoolId]
      .acquire()
      .then(sock =>
        sock.write(
          msg,
          promisifyCallback(
            () => {
              app.socketPools[socketPoolId].release(sock)
              logger.debug(emphasize(`[socket ${socketPoolId}]\n${redact(msg)}`))

              const type = (data.messageBody || '').includes('healthcheck')
                ? 'healthcheck'
                : data.type
              metrics.incrementCounter(SIGNALD_MESSAGES, [type, data.username, OUTBOUND])

              return resolve(id)
            },
            e => {
              app.socketPools[socketPoolId].release(sock)
              return reject({
                status: statuses.ERROR,
                message: `Error writing message ${id}: ${e.message}`,
              })
            },
          ),
        ),
      )
      .catch(reject),
  )
}

module.exports = {
  write,
}
