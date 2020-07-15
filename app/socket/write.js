const app = require('../../app')
const util = require('../util')
const { emphasize, redact } = util
const metrics = require('../metrics')
const { statuses, promisifyCallback } = require('../util')
const logger = util.loggerOf('socket.write')

// object -> Promise<void>
const write = data => {
  const id = util.genUuid()
  const msg = signaldEncode({ ...data, id })
  return new Promise((resolve, reject) =>
    app.socketPool
      .acquire()
      .then(sock =>
        sock.write(
          msg,
          promisifyCallback(
            () => {
              app.socketPool.release(sock)

              logger.debug(emphasize(redact(msg)))
              metrics.incrementCounter(metrics.counters.SIGNALD_MESSAGES, [
                data.type,
                data.username,
                metrics.messageDirection.OUTBOUND,
              ])

              return resolve(id)
            },
            e => {
              app.socketPool.release(sock)
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

// object -> string
const signaldEncode = data => JSON.stringify(data) + '\n'

module.exports = {
  write,
  signaldEncode,
}
