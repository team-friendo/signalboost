import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import app from '../../../app'
import testApp from '../../support/testApp'
import util from '../../../app/util'
import { socketPoolOf } from '../../../app/socket'
import { write } from '../../../app/socket/write'

describe('writing to a socket', () => {
  let writeStub, acquireSpy, releaseSpy

  beforeEach(async () => {
    writeStub = sinon.stub().callsFake((data, cb) => cb(null, true))
    sinon.stub(util, 'genUuid').returns('acab')
    await app.run({
      ...testApp,
      socketPools: {
        run: () =>
          Promise.all([
            socketPoolOf({
              create: () => Promise.resolve({ write: writeStub }),
              destroy: () => Promise.resolve(),
            }),
          ]),
      },
    })
    acquireSpy = sinon.spy(app.socketPools[0], 'acquire')
    releaseSpy = sinon.spy(app.socketPools[0], 'release')
  })
  afterEach(() => sinon.restore())

  it('acquires a socket from the pool, writes a signald-encoded message to it and releases it', async () => {
    await write({ foo: 'bar' }, 0)
    expect(acquireSpy.callCount).to.eql(1)
    expect(writeStub.getCall(0).args[0]).to.eql('{"foo":"bar","id":"acab"}\n')
    expect(releaseSpy.callCount).to.eql(1)
  })
})
