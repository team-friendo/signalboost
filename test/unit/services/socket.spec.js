import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import fs from 'fs-extra'
import net from 'net'
import { wait } from '../../../app/services/util'
import { EventEmitter } from 'events'
import socket from '../../../app/services/socket'

describe('socket module', () => {
  const sock = new EventEmitter()
  sock.setEncoding = () => null

  afterEach(() => {
    sinon.restore()
  })

  describe('getting a socket', () => {
    let pathExistsStub, connectStub

    beforeEach(() => {
      pathExistsStub = sinon.stub(fs, 'pathExists')
      connectStub = sinon.stub(net, 'createConnection').returns(sock)
    })

    afterEach(() => {
      pathExistsStub.restore()
      connectStub.restore()
    })

    describe('when socket is eventually available', () => {
      let result
      beforeEach(async () => {
        pathExistsStub.onCall(0).returns(Promise.resolve(false))
        pathExistsStub.onCall(1).returns(Promise.resolve(false))
        pathExistsStub.onCall(2).callsFake(() => {
          wait(5).then(() => sock.emit('connect', sock))
          return Promise.resolve(true)
        })
        result = await socket.getSocket()
      })

      it('looks for a socket descriptor at an interval', async () => {
        expect(pathExistsStub.callCount).to.eql(3)
      })

      it('connects to socket once it exists', () => {
        expect(connectStub.callCount).to.eql(1)
      })

      it('returns the connected socket', () => {
        expect(result).to.eql(sock)
      })
    })

    describe('when connection is never available', () => {
      beforeEach(() => pathExistsStub.returns(Promise.resolve(false)))

      it('attempts to connect a finite number of times then rejects', async () => {
        const result = await socket.getSocket().catch(a => a)
        expect(pathExistsStub.callCount).to.be.above(10)
        expect(connectStub.callCount).to.eql(0)
        expect(result.message).to.eql('Maximum signald connection attempts exceeded.')
      })
    })
  })
})
