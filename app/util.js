const { concat, take, drop, isEmpty, get } = require('lodash')
const uuidV4 = require('uuid/v4')
const stringHash = require('string-hash')
const moment = require('moment')
const crypto = require('crypto')
const {
  crypto: { hashSalt },
} = require('./config')

/********* Non-deterministic generators *********/

const genUuid = uuidV4

/**************** Promises ****************/

const exec = (cmd, logger = console) =>
  require('util')
    .promisify(require('child_process').exec)(cmd)
    .then((stdout, stderr) => {
      logger.log(stdout)
      logger.error({ message: stderr })
    })
    .catch(logger.error)

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

const repeatUntilCancelled = (fn, interval) => {
  let shouldContinue = true
  const cancel = () => (shouldContinue = false)
  const repeat = (fn, interval) =>
    !shouldContinue
      ? Promise.resolve()
      : Promise.resolve(fn())
          .then(() => wait(interval))
          .then(() => repeat(fn, interval))
  repeat(fn, interval)
  return cancel
}

const repeatUntilTimeout = (fn, interval, timeout) => {
  const now = nowInMillis()
  repeatUntil(fn, interval, () => nowInMillis() > now + timeout)
}

// (Array<(Any) -> Promise<Any>>, number) -> Promise<Array>
const sequence = async (asyncFuncs, delay = 0) => {
  const [hd, tl] = [asyncFuncs[0] || (() => []), asyncFuncs.slice(1)]
  return [await hd()].concat(
    tl.length === 0 ? [] : await wait(delay).then(() => sequence(tl, delay)),
  )
}

const batchesOfN = (arr, n) =>
  isEmpty(arr) ? [] : concat([take(arr, n)], batchesOfN(drop(arr, n), n))

const now = () => moment()

const nowInMillis = () => moment().valueOf()

const nowTimestamp = () => moment().toISOString()

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

const emphasize = msg => `\n--------\n${msg}----------------\n`

const sha256Hash = str =>
  crypto
    .createHash('sha256')
    .update(str + hashSalt)
    .digest('hex')

const hash = str => stringHash(str + hashSalt)

const redact = str =>
  process.env.NODE_ENV === 'development' || isEmpty(str)
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
  now,
  nowInMillis,
  nowTimestamp,
  prettyPrint,
  promisifyCallback,
  redact,
  repeatEvery,
  repeatUntilTimeout,
  repeatUntilCancelled,
  sha256Hash,
  sequence,
  statuses,
  wait,
}
