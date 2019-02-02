const { initDb } = require('../../db')
const orchestrator = require('./index')
const {
  orchestrator: { port },
} = require('../../config')

orchestrator.run(initDb(), port).then(() => {
  console.log(`> Orchestrator listening on port: ${port}...`)
})
