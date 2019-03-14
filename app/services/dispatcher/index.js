const { run } = require('./run')
const { initDb } = require('../../db')

run(initDb())
