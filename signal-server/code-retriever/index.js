const express = require("express")
const Sequelize = require("sequelize")

const app = express()
const SERVER_PORT = 3000

const fetchVerificationCode = async (dbClient, phoneNumber) => {
  const queryResults = await dbClient.query(
    `SELECT verification_code FROM pending_accounts WHERE number = '${phoneNumber}' LIMIT 1;`,
    { type: dbClient.QueryTypes.SELECT }
  )
  return queryResults.length != 0 ? queryResults[0].verification_code : null
}

const resetDatabase = async (dbClient) => {
  await dbClient.query('DELETE FROM pending_accounts; DELETE FROM keys; DELETE FROM accounts;')
}

const run = () => {
  const dbClient = new Sequelize('postgres://signal:password@db:5432/signal')

  app.get('/phone/:number', async (req, res) => {
    const phoneNumber = req.params.number
    const code = await fetchVerificationCode(dbClient, phoneNumber)
    res.send({ verificationCode: code })
  })

  app.post('/reset', async (req, res) => {
    await resetDatabase(dbClient)
    res.send({ status: "reset" })
  })

  app.listen(SERVER_PORT)
  console.log(`Server started on port ${SERVER_PORT}`)
}

run()
