const app = require('../../app')
const metrics = require('../metrics')
const { statuses, promisifyCallback } = require('../util')

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
  write,
  signaldEncode,
}
