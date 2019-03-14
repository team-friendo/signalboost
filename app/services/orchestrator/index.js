const { run } = require('./run')
const { initDb } = require('../../db')
const { EventEmitter } = require('events')

// we allow an infinite number of event listeners
run(initDb(), new EventEmitter().setMaxListeners(0))
