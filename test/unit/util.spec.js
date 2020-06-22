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
})
