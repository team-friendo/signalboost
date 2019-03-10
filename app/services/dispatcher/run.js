const dispatcher = require('./index')
const { initDb } = require('../../db')

dispatcher.run(initDb())

