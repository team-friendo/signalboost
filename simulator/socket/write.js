const simulator = require('../index')
const util = require('../../app/util')
const { statuses, promisifyCallback } = require('../../app/util')
const logger = util.loggerOf('socket.write')

// object -> Promise<void>
const write = data => {
  const id = util.genUuid()
  const msg = signaldEncode({ ...data, id })
  return new Promise((resolve, reject) =>
    simulator.socketPool
      .acquire()
      .then(sock =>
        sock.write(
          msg,
          promisifyCallback(
            () => {
              simulator.socketPool.release(sock)

              return resolve(id)
            },
            e => {
              simulator.socketPool.release(sock)
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
