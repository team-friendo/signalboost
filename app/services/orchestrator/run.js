const orchestrator = require('./index')
const { initDb } = require('../../db')
const { EventEmitter } = require('events')
const {
  orchestrator: { port },
} = require('../../config')

orchestrator.run(port, initDb(), new EventEmitter())
