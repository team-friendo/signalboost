const util = require('util')

const exec = util.promisify(require('child_process').exec)

const promisifyCallback = (resolve, reject) => (err, res) => {
  if (err) reject(err)
  else resolve(res)
}

const wait = interval => new Promise(rslv => setTimeout(rslv, interval))

const repeatUntil = (fn, interval, predicate) =>
  predicate()
    ? Promise.resolve()
    : Promise.resolve(fn())
        .then(() => wait(interval))
        .then(() => repeatUntil(fn, interval, predicate))

const repeatUntilTimeout = (fn, interval, timeout) => {
  const now = getNow()
  repeatUntil(fn, interval, () => getNow() > now + timeout)
}

const getNow = () => new Date().getTime()

module.exports = { exec, promisifyCallback, wait, repeatUntilTimeout }
