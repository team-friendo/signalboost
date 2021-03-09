import { expect } from 'chai'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import app from '../../../../app'
import dbService from '../../../../app/db'
import testApp from '../../../support/testApp'
import channelRequestRepository from '../../../../app/db/repositories/channelRequest'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('channelRequest repository', () => {
  const adminPhoneNumbers = [genPhoneNumber(), genPhoneNumber()]
  let db, channelRequestCount

  describe('#addToWaitlist', () => {
    before(async () => (db = (await app.run({ ...testApp, db: dbService })).db))
    beforeEach(async () => (channelRequestCount = await db.channelRequest.count()))
    afterEach(async () => db.channelRequest.destroy({ where: {}, force: true }))
    after(async () => await app.stop())

    it('creates a channel request with JSON-serialized admin phone numbers', async () => {
      const channelRequest = await channelRequestRepository.addToWaitlist(adminPhoneNumbers)
      expect(await db.channelRequest.count()).to.eql(channelRequestCount + 1)
      expect(channelRequest.adminPhoneNumbers).to.eql(JSON.stringify(adminPhoneNumbers))
    })
  })
})
