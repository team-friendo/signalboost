const util = require('util')
const exec = util.promisify(require('child_process').exec)

const message = 'hello there signal blasters... via node and dbus!'
const recipients = [
  process.env.AGUESTUSER_NUMBER,
  process.env.RELAY_NUMBER,
]

const relay = async (msg, recipients) => {
  console.log(`--- sending "${msg}" to [${recipients}]`)
  await exec(
    `signal-cli --dbus-system send -m "${msg}" ${fmtRecipients(recipients)}`
  ).catch(console.error)
}

const fmtRecipients = recipients =>
  recipients.map(r => `"${r}"`).join(" ")

// TODO: remove after verification
relay(message, recipients)
