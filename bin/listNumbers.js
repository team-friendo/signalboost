const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const client = require('twilio')(accountSid, authToken)

client
  .incomingPhoneNumbers
  .each(x => console.log(x.phoneNumber, ':', x.sid))


