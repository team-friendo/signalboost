const express = require("express")
const Sequelize = require("sequelize")

const app = express()
const SERVER_PORT = 3000

const fetchVerificationCode = async phoneNumber => {
  const sequelize = new Sequelize('postgres://signal:password@db:5432/signal')
  const sqlResults = await sequelize.query(
    `SELECT verification_code FROM pending_accounts WHERE number = '${phoneNumber}' LIMIT 1;`,
    { type: sequelize.QueryTypes.SELECT }
  )
  return sqlResults.length != 0 ? sqlResults[0].verification_code : null
}

const run = () => {
  app.get('/phone/:number', async (req, res) => {
    const phoneNumber = req.params.number
    const code = await fetchVerificationCode(phoneNumber)
    res.send({ verificationCode: code })
  })

  app.listen(SERVER_PORT)
  console.log(`Server started on port ${SERVER_PORT}`)
}

run()
