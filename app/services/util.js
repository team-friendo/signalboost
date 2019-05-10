const { concat, take, drop, isEmpty } = require('lodash')

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

// (Array<(Any) -> Promise<Any>>, number) -> Promise<Array>
const sequence = async (asyncFuncs, delay = 0) => {
  if (asyncFuncs.length === 0) {
    return []
  } else {
    return [await asyncFuncs[0]()].concat(
      await wait(delay).then(() => sequence(asyncFuncs.slice(1), delay)),
    )
  }
}

const batchesOfN = (arr, n) =>
  isEmpty(arr) ? [] : concat([take(arr, n)], batchesOfN(drop(arr, n), n))

const nowInMillis = () => new Date().getTime()

const nowTimestamp = () => new Date().toISOString()

/**************** Logging ****************/

const loggerOf = prefix =>
  process.env.NODE_ENV === 'test'
    ? { log: () => null, error: () => null, fatalError: () => null }
    : {
        log: msg => console.log(`[${prefix} | ${nowTimestamp()}] ${msg}`),
        error: e => console.error(`[${prefix} | ${nowTimestamp()}] ${e.stack}`),
        fatalError: e => {
          console.error(`[${prefix} | ${nowTimestamp()}] ${e.stack}`)
          console.error('ABORTING.')
          process.exit(1)
        },
      }

const logger = loggerOf('signalboost')

const prettyPrint = obj => JSON.stringify(obj, null, '  ')

module.exports = {
  batchesOfN,
  exec,
  loggerOf,
  logger,
  prettyPrint,
  promisifyCallback,
  repeatUntilTimeout,
  sequence,
  wait,
}
