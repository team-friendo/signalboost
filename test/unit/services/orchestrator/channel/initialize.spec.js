import { expect } from 'chai'
import { describe, it, before, after } from 'mocha'
import sinon from 'sinon'
import { genPhoneNumber } from '../../../../support/factories/phoneNumber'
import channelRepository from '../../../../../app/db/repositories/channel'
import phoneNumberService from '../../../../../app/services/orchestrator/phoneNumber'
import activateModule from '../../../../../app/services/orchestrator/channel/activate'
import { initialize } from '../../../../../app/services/orchestrator/channel/initialize'

describe('channel initialization module', () => {
  const channelAttrs = [
    { phoneNumber: genPhoneNumber(), name: 'foo1' },
    { phoneNumber: genPhoneNumber(), name: 'foo2' },
    { phoneNumber: genPhoneNumber(), name: 'foo3' },
  ]
  const db = {}
  const emitter = {}
  let registerAllStub, activateManyStub, findAllChannelsStub

  describe('initializing all channels', () => {
    let result
    before(async () => {
      registerAllStub = sinon.stub(phoneNumberService, 'registerAllUnregistered').returns(
        Promise.resolve([
          {
            phoneNumber: genPhoneNumber(),
            status: 'VERIFIED',
          },
        ]),
      )

      findAllChannelsStub = sinon
        .stub(channelRepository, 'findAll')
        .returns(Promise.resolve(channelAttrs))

      activateManyStub = sinon
        .stub(activateModule, 'activateMany')
        .callsFake((db, chs) => chs.map(ch => ({ ...ch, status: 'ACTIVE' })))

      result = await initialize({ db, emitter })
    })

    after(() => {
      registerAllStub.restore()
      activateManyStub.restore()
      findAllChannelsStub.restore()
    })

    it('registers all phone numbers', () => {
      expect(registerAllStub.getCall(0).args[0]).to.eql({ db, emitter })
    })

    it('activates all channels', () => {
      expect(activateManyStub.getCall(0).args).to.eql([db, channelAttrs])
    })

    it('returns a status result', () => {
      expect(result).to.eql({ registered: 1, activated: 3 })
    })
  })
})
