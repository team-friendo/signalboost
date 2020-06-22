const { concat, take, drop, isEmpty, get } = require('lodash')

/**************** Promises ****************/

const exec = require('util').promisify(require('child_process').exec)

const promisifyCallback = (resolve, reject) => (err, res) => {
  if (err) reject(err)
  else resolve(res)
}

/**************** Time ****************/

const wait = interval => new Promise(rslv => setTimeout(rslv, interval))

const repeatEvery = (fn, interval) =>
  Promise.resolve(fn())
    .then(() => wait(interval))
    .then(() => repeatEvery(fn, interval))

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
  const [hd, tl] = [asyncFuncs[0] || (() => []), asyncFuncs.slice(1)]
  return [await hd()].concat(
    tl.length === 0 ? [] : await wait(delay).then(() => sequence(asyncFuncs.slice(1), delay)),
  )
}

const batchesOfN = (arr, n) =>
  isEmpty(arr) ? [] : concat([take(arr, n)], batchesOfN(drop(arr, n), n))

const nowInMillis = () => new Date().getTime()

const nowTimestamp = () => new Date().toISOString()

/**************** Logging ****************/

const loggerOf = prefix =>
  process.env.NODE_ENV === 'test'
    ? { log: () => null, logAndReturn: () => null, error: () => null, fatalError: () => null }
    : {
        log: msg => console.log(`[${prefix} | ${nowTimestamp()}] ${msg}`),
        logAndReturn: sbStatus => {
          console.log(`[${prefix} | ${nowTimestamp()}] ${sbStatus.status} ${sbStatus.message}`)
          return sbStatus
        },
        error: e =>
          console.error(
            `[${prefix} | ${nowTimestamp()}] ${get(e, 'errors[0].message', e.message)}\n${e.stack}`,
          ),
        fatalError: e => {
          console.error(`[${prefix} | ${nowTimestamp()}] ${e.message}\n${e.stack}`)
          throw e
        },
      }

const logger = loggerOf('signalboost')

const prettyPrint = obj => JSON.stringify(obj, null, '  ')

/*************** Statuses ********************/

const statuses = {
  SUCCESS: 'SUCCESS',
  NOOP: 'NOOP',
  ERROR: 'ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
}

const defaultErrorOf = err => ({
  status: statuses.ERROR,
  message: err.message,
})

module.exports = {
  defaultErrorOf,
  batchesOfN,
  exec,
  loggerOf,
  logger,
  prettyPrint,
  promisifyCallback,
  repeatEvery,
  repeatUntilTimeout,
  sequence,
  statuses,
  wait,
}
