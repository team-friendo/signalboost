const app = require('./index')

app.seed().then(() => {
  console.log("Finished seeding!")
  process.exit(0)
})