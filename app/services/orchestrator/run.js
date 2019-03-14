const orchestrator = require('./index')
const { initDb } = require('../../db')
const { EventEmitter } = require('events')

// we allow an infinite number of event listeners
orchestrator.run(initDb(), new EventEmitter().setMaxListeners(0))
