const app = require('../../app')
const util = require('../util')
const metrics = require('../metrics')
const { statuses, promisifyCallback } = require('../util')

// object -> Promise<void>
const write = data => {
  const id = util.genUuid()
  return new Promise((resolve, reject) =>
    app.socketPool
      .acquire()
      .then(sock =>
        sock.write(
          signaldEncode({ ...data, id }),
          promisifyCallback(
            () => {
              app.socketPool.release(sock)
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
