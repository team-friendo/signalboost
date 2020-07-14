import { expect } from 'chai'
import { describe, it } from 'mocha'
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
  })
})
