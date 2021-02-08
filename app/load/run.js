const app = require('../index')
const load = require('./load')

const signal = { 
  run: async () => {
    await load.run()
  }
}

app.run({ signal })
