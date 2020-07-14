const { concat, take, drop, isEmpty, get } = require('lodash')
const uuidV4 = require('uuid/v4')
const stringHash = require('string-hash')

/********* Non-deterministic generators *********/

const genUuid = uuidV4

/**************** Promises ****************/

const exec = require('util').promisify(require('child_process').exec)

const promisifyCallback = (resolve, reject) => (err, res) => {
  if (err) reject(err)
  else resolve(res)
}

const noop = () => null

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
    ? {
        log: () => null,
        logAndReturn: () => null,
        debug: () => null,
        error: () => null,
        fatalError: () => null,
      }
    : {
        log: msg => console.log(`[${prefix} | ${nowTimestamp()}] ${msg}`),
        logAndReturn: sbStatus => {
          console.log(`[${prefix} | ${nowTimestamp()}] ${sbStatus.status} ${sbStatus.message}`)
          return sbStatus
        },
        debug: msg => {
          if (process.env.SIGNALBOOST_VERBOSE_LOG === '1')
            console.log(`[${prefix} | ${nowTimestamp()}] ${msg}`)
        },
        error: e =>
          console.error(
            `[${prefix} | ${nowTimestamp()}] ${get(e, 'errors[0].message', e.message)}\n${e.stack}`,
          ),
        fatalError: e => {
          console.error(`[${prefix} | ${nowTimestamp()}] ${e.message}\n${e.stack}`)
          console.log('ABORTING')
          process.exit(1)
        },
      }

const logger = loggerOf('signalboost')

const prettyPrint = obj => JSON.stringify(obj, null, '  ')

const emphasize = msg => `\n----------------\n${msg}----------------\n`

const _defaultSalt = '483157e72a4c17227f1feb2d437430eecb9f72b0a8691ab38c121d217f95518f'

const hash = str => stringHash(str + (process.env.SIGNALBOOST_HASH_SALT || _defaultSalt))

const redact = str =>
  process.env.NODE_ENV === 'development'
    ? str
    : str
        .replace(/\+\d{9,15}/g, hash)
        .replace(/"(messageBody|body)":"([^"]*)"/, (_, key, msg) => `"${key}":"${hash(msg)}"`)

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
  emphasize,
  exec,
  genUuid,
  hash,
  loggerOf,
  logger,
  noop,
  nowInMillis,
  nowTimestamp,
  prettyPrint,
  promisifyCallback,
  redact,
  repeatEvery,
  repeatUntilTimeout,
  sequence,
  statuses,
  wait,
}
