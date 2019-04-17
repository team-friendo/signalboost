const { run } = require('./run')
const { initDb } = require('../../db')
const { EventEmitter } = require('events')

EventEmitter.defaultMaxListeners = 100

// we allow an infinite number of event listeners
run(initDb(), new EventEmitter().setMaxListeners(0))
