import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import fs from 'fs-extra'
import net from 'net'
import sockets from '../../app/sockets'
import metrics from '../../app/metrics'
const {
  counters: { SIGNALD_MESSAGES },
  messageDirection: { OUTBOUND },
} = metrics
import util, { wait } from '../../app/util'
import { EventEmitter } from 'events'
import { genPhoneNumber } from '../support/factories/phoneNumber'
import { sdMessageOf } from '../../app/signal/constants'

const {
  socket: { availableSockets, poolSize },
} = require('../../app/config')

describe('sockets module', () => {
  const sock = new EventEmitter()
  sock.setEncoding = () => null
  const uuid = util.genUuid()

  let incrementCounterStub,
    writeStub,
    acquireSpy,
    releaseSpy,
    connectStub,
    socketPathExistsStub,
    destroyStub

  beforeEach(async () => {
    sinon.stub(util, 'genUuid').returns(uuid)
    socketPathExistsStub = sinon.stub(fs, 'pathExists').returns(true)
    incrementCounterStub = sinon.stub(metrics, 'incrementCounter')
    connectStub = sinon.stub(net, 'createConnection').returns(sock)
    sock.write = sinon.stub().callsFake((data, cb) => cb(null, true))
    sock.destroy = sinon.stub()
    writeStub = sock.write
    destroyStub = sock.destroy
  })

  afterEach(() => sinon.restore())

  describe('#createConnectionPool', async () => {
    let sx, pool
    beforeEach(async () => {
      sx = await sockets.run()
      sock.emit('connect')
      pool = sx[0]
    })

    it('creates a fixed-size pool', async () => {
      expect(pool.max).to.eql(poolSize)
      expect(pool.min).to.eql(poolSize)
    })

    it("stores the socket's id on the connection pool", () => {
      expect(pool.socketId).to.eql(0)
    })

    it('appends write and stop methods to the pool', () => {
      expect(pool.stop).to.be.a('function')
      expect(pool.write).to.be.a('function')
    })
  })

  describe('#createNConnectionPool', async () => {
    let sx
    beforeEach(async () => {
      sx = await sockets.run()
      sock.emit('connect')
    })

    it('creates n fixed-size pools', async () => {
      const idx = availableSockets - 1
      expect(sx[idx]).to.exist
      expect(sx[idx].size).to.eql(poolSize)
    })

    it('appends helper functions to the collection of pools', () => {
      expect(sx.awaitClose).to.be.a('function')
      expect(sx.stop).to.be.a('function')
      expect(sx.stopSocket).to.be.a('function')
      expect(sx.restartSocket).to.be.a('function')
      expect(sx.write).to.be.a('function')
    })
  })

  describe('#getConnection', () => {
    describe('when socket is eventually available', () => {
      let result
      beforeEach(async () => {
        socketPathExistsStub.onCall(0).returns(Promise.resolve(false))
        socketPathExistsStub.onCall(1).returns(Promise.resolve(false))
        socketPathExistsStub.onCall(2).callsFake(() => {
          wait(5).then(() => sock.emit('connect', sock))
          return Promise.resolve(true)
        })
        result = await sockets.getConnection()
      })

      it('looks for a socket descriptor at an interval', async () => {
        expect(socketPathExistsStub.callCount).to.eql(3)
      })

      it('connects to socket once it exists', () => {
        expect(connectStub.callCount).to.eql(1)
      })

      it('returns the connected socket', () => {
        expect(result).to.eql(sock)
      })
    })

    describe('when connection is never available', () => {
      beforeEach(() => socketPathExistsStub.returns(Promise.resolve(false)))

      it('attempts to connect a finite number of times then rejects', async () => {
        const result = await sockets.getConnection().catch(a => a)
        expect(socketPathExistsStub.callCount).to.be.above(10)
        expect(connectStub.callCount).to.eql(0)
        expect(result.message).to.eql('Maximum signald connection attempts exceeded.')
      })
    })
  })

  describe('#write', () => {
    const sdMessage = sdMessageOf({
      sender: genPhoneNumber(),
      recipient: genPhoneNumber(),
      message: 'foo',
    })

    beforeEach(async () => {
      const sx = await sockets.run()
      acquireSpy = sinon.spy(sx[0], 'acquire')
      releaseSpy = sinon.spy(sx[0], 'release')
      sock.emit('connect')
      await sx.write(sdMessage, 0)
    })

    it('acquires a socket connection from the pool', () => {
      expect(acquireSpy.callCount).to.eql(1)
    })

    it('appends an id to the message, JSON-encodes it and writes it to the socket', () => {
      expect(writeStub.getCall(0).args[0]).to.eql(JSON.stringify({ ...sdMessage, id: uuid }) + '\n')
    })

    it('increments a messages counter', () => {
      expect(incrementCounterStub.getCall(0).args).to.have.deep.members([
        SIGNALD_MESSAGES,
        ['send', sdMessage.username, OUTBOUND],
      ])
    })

    it('releases the socket connection back to the pool', () => {
      expect(releaseSpy.callCount).to.eql(1)
    })
  })

  describe('#awaitClose', () => {
    let sx

    beforeEach(async () => {
      sx = await sockets.run()
      sock.emit('connect')
    })

    describe('when server closes connection before timeout', () => {
      beforeEach(() => socketPathExistsStub.returns(Promise.resolve(false)))

      it('resolves a promise', async () => {
        expect(await sx.awaitClose(0)).to.eql(true)
      })
    })

    describe('when server does not close connection before timeout', () => {
      beforeEach(() => socketPathExistsStub.returns(Promise.resolve(true)))
      it('rejects a promise', async () => {
        const err = await sx.awaitClose(0).catch(x => x)
        expect(err).to.include('timed out')
      })
    })
  })

  describe('#stopSocket', () => {
    let sx
    beforeEach(async () => {
      sx = await sockets.run()
      sock.emit('connect')
    })

    it('destroys all connections in the pool', async () => {
      expect(sx.size(0)).to.eql(poolSize)
      await sx.stopSocket(0)
      expect(destroyStub.callCount).to.eql(poolSize)
      expect(sx.size(0)).to.eql(0)
    })
  })

  describe('#restartSocket', () => {
    let sx
    beforeEach(async () => {
      sx = await sockets.run()
      sock.emit('connect')
    })

    it('creates a socket connection pool on the socket with a given id', async () => {
      await sx.stopSocket(0)
      expect(sx.size(0)).to.eql(0)
      await sx.restartSocket(0)
      expect(sx.size(0)).to.eql(poolSize)
    })
  })
})
