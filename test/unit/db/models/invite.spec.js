import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import { run } from '../../../../app/db/index'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { inviteFactory } from '../../../support/factories/invite'

describe('invite model', () => {
  let db, invite

  before(async () => {
    db = await run()
  })

  after(async () => {
    await db.invite.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
    await db.stop()
  })

  it('has correct fields', async () => {
    invite = await db.invite.create(inviteFactory())
    expect(invite.id).to.be.a('string')
    expect(invite.channelPhoneNumber).to.be.a('string')
    expect(invite.inviterPhoneNumber).to.be.a('string')
    expect(invite.inviteePhoneNumber).to.be.a('string')
    expect(invite.createdAt).to.be.a('Date')
    expect(invite.updatedAt).to.be.a('Date')
  })

  describe('validations', () => {
    it('does not allow dupe invites on same channel', async () => {
      const channelPhoneNumber = genPhoneNumber()
      const inviterPhoneNumber = genPhoneNumber()
      const inviteePhoneNumber = genPhoneNumber()
      await db.invite.create(
        inviteFactory({ channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber }),
      )
      const result = await db.invite
        .create(inviteFactory({ channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('unique')
    })

    it('does not allow invalid channel phone numbers', async () => {
      const result = await db.invite
        .create(inviteFactory({ channelPhoneNumber: 'foo' }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('phone number')
    })

    it('does not allow invalid inviter phone numbers', async () => {
      const result = await db.invite
        .create(inviteFactory({ inviterPhoneNumber: 'foo' }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('phone number')
    })

    it('does not allow invalid invitee phone numbers', async () => {
      const result = await db.invite
        .create(inviteFactory({ inviteePhoneNumber: 'foo' }))
        .catch(a => a)
      expect(result.errors[0].message).to.include('phone number')
    })
  })

  describe('associations', () => {
    before(async () => {
      const channel = await db.channel.create(channelFactory())
      invite = await db.invite.create(
        inviteFactory({
          channelPhoneNumber: channel.phoneNumber,
        }),
      )
    })

    it('belongs to a channel', async () => {
      expect(await invite.getChannel()).to.be.an('object')
    })
  })
})
