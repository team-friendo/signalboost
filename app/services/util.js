/**************** Promises ****************/

const exec = require('util').promisify(require('child_process').exec)

const promisifyCallback = (resolve, reject) => (err, res) => {
  if (err) reject(err)
  else resolve(res)
}

/**************** Time ****************/

const wait = interval => new Promise(rslv => setTimeout(rslv, interval))

const repeatUntil = (fn, interval, predicate) =>
  predicate()
    ? Promise.resolve()
    : Promise.resolve(fn())
        .then(() => wait(interval))
        .then(() => repeatUntil(fn, interval, predicate))

const repeatUntilTimeout = (fn, interval, timeout) => {
  const now = nowInMillis()
  repeatUntil(fn, interval, () => nowInMillis() > now + timeout)
}

const nowInMillis = () => new Date().getTime()

const nowTimestamp = () => new Date().toISOString()

/**************** Logging ****************/

const loggerOf = prefix =>
  process.env.NODE_ENV === 'test'
    ? { log: () => null, error: () => null }
    : {
        log: msg => console.log(`[${prefix} | ${nowTimestamp()}] ${msg}`),
        error: e => console.error(`[${prefix} | ${nowTimestamp()}] ${e.message}\n${e.stack}`),
      }

const prettyPrint = obj => JSON.stringify(obj, null, '  ')

module.exports = { exec, promisifyCallback, wait, repeatUntilTimeout, prettyPrint, loggerOf }
