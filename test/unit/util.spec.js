import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import util from '../../app/util'

describe('utility module', () => {
  describe('#sequence', () => {
    it('calls an array of async funcs with a delay in between each call returning their results', async () => {
      const start = new Date().getTime()
      const asyncFuncs = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
      ]
      const result = await util.sequence(asyncFuncs, 100)
      const elapsed = new Date().getTime() - start

      expect(result).to.eql([1, 2, 3])
      expect(elapsed).to.be.at.least(200)
    })

    it('rejects a catchable promise if any function throws', async () => {
      const asyncFuncs = [
        () => Promise.resolve(1),
        () => {
          throw new Error('oh noes!')
        },
        () => Promise.resolve(3),
      ]
      try {
        await util.sequence(asyncFuncs, 100)
      } catch (e) {
        expect(e.message).to.eql('oh noes!')
      }
    })

    it('rejects a catchable promise if any function rejects a promise', async () => {
      const asyncFuncs = [
        () => Promise.resolve(1),
        () => Promise.reject('oh noes!'),
        () => Promise.resolve(3),
      ]
      try {
        await util.sequence(asyncFuncs, 100)
      } catch (e) {
        expect(e).to.eql('oh noes!')
      }
    })
  })

  describe('#batchesOfN', () => {
    it('partitions an array with length M into M/N subarrays with length N', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8]
      expect(util.batchesOfN(arr, 3)).to.eql([[1, 2, 3], [4, 5, 6], [7, 8]])
    })
  })

  describe('#redact', () => {
    it('hashes messages and phone numbers in an inbound sd message', () => {
      const unredacted = JSON.stringify({
        type: 'message',
        data: {
          username: '+12223334444',
          source: { number: '+14443332222' },
          dataMessage: {
            body: 'meet me at the docs at midnight!',
          },
        },
      })
      const redacted = JSON.stringify({
        type: 'message',
        data: {
          username: '2721981381',
          source: { number: '404640259' },
          dataMessage: { body: '500899152' },
        },
      })

      expect(util.redact(unredacted)).to.eql(redacted)
    })

    it('hashes messages and phone numbers in an outbound sd message', () => {
      const unredacted = JSON.stringify({
        type: 'send',
        username: '+12223334444',
        recipient: { number: '+14443332222' },
        messageBody: 'meet me at the docs at midnight!',
      })
      const redacted = JSON.stringify({
        type: 'send',
        username: '2721981381',
        recipient: { number: '404640259' },
        messageBody: '500899152',
      })
      expect(util.redact(unredacted)).to.eql(redacted)
    })

    it('handles empty messages without throwing', () => {
      expect(util.redact(null)).to.eql(null)
      expect(util.redact(undefined)).to.eql(undefined)
      expect(util.redact('')).to.eql('')
    })

    describe('in dev mode', () => {
      let originalEnv
      beforeEach(() => {
        originalEnv = process.env.NODE_ENV
        process.env.NODE_ENV = 'development'
      })
      afterEach(() => (process.env.NODE_ENV = originalEnv))

      it('does not hash anything', () => {
        const unredacted = JSON.stringify({
          type: 'send',
          username: '+12223334444',
          recipient: { number: '+14443332222' },
          messageBody: 'meet me at the docs at midnight!',
        })
        expect(util.redact(unredacted)).to.eql(unredacted)
      })
    })
  })

  describe('#repeatUntilCancelled', () => {
    it('calls a function repeatedly until it is cancelled', async () => {
      const fn = sinon.stub().returns(Promise.resolve())
      const interval = 20
      const cancel = util.repeatUntilCancelled(fn, interval)
      await util.wait(2 * interval)
      expect(fn.callCount).to.eql(2)
      cancel()
      await util.wait(2 * interval)
      expect(fn.callCount).to.eql(2)
    })
  })

  describe('#millisAs', () => {
    it('converts millis into weeks', () => {
      expect(util.millisAs(1000 * 60 * 60 * 24 * 14, 'weeks')).to.eql(2)
      expect(util.millisAs(1000 * 60 * 60 * 24 * 3.5, 'week')).to.eql(0.5)
    })

    it('converts millis into days', () => {
      expect(util.millisAs(1000 * 60 * 60 * 48, 'days')).to.eql(2)
      expect(util.millisAs(1000 * 60 * 60 * 12, 'day')).to.eql(0.5)
    })
    it('converts millis into hours', () => {
      expect(util.millisAs(1000 * 60 * 60 * 24, 'hours')).to.eql(24)
      expect(util.millisAs(1000 * 60 * 30, 'hour')).to.eql(0.5)
    })
    it('converts millis into minutes', () => {
      expect(util.millisAs(1000 * 60 * 2, 'minutes')).to.eql(2)
      expect(util.millisAs(1000 * 30, 'minute')).to.eql(0.5)
    })
    it('converts millis into seconds', () => {
      expect(util.millisAs(1000 * 2, 'seconds')).to.eql(2)
      expect(util.millisAs(500, 'second')).to.eql(0.5)
    })
  })
})
