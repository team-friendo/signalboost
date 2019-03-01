const orchestrator = require('./index')
const { initDb } = require('../../db')
const { EventEmitter } = require('events')

orchestrator.run(initDb(), new EventEmitter())
