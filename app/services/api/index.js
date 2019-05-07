const { run } = require('./run')
const { initDb } = require('../../db')

// we allow an infinite number of event listeners
run(initDb())
