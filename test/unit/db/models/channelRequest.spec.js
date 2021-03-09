import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { run } from '../../../../app/db/index'
import { channelRequestFactory } from '../../../support/factories/channelRequest'
import { isArray } from 'lodash'

describe('channelRequests model', () => {
  let db

  before(async () => {
    db = await run()
  })
  after(async () => {
    await db.channelRequest.destroy({ where: {} })
    await db.stop()
  })

  it('has correct fields', async () => {
    const channelRequest = await db.channelRequest.create(channelRequestFactory())
    expect(channelRequest.id).to.be.a('string')
    expect(channelRequest.createdAt).to.be.a('Date')
    expect(channelRequest.updatedAt).to.be.a('Date')

    expect(channelRequest.adminPhoneNumbers).to.be.a('string')
    expect(isArray(JSON.parse(channelRequest.adminPhoneNumbers))).to.be.true
  })

  describe('validations', () => {
    it('does not allow null adminPhoneNumbers field', async () => {
      const err = await db.channelRequest
        .create(
          channelRequestFactory({
            adminPhoneNumbers: undefined,
          }),
        )
        .catch(e => e)
      expect(err.message).to.contain('notNull')
    })
  })
})
