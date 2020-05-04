const {
  twiml: { MessagingResponse },
} = require('twilio')
const signal = require('../../signal')
const registrationService = require('./register')
const { statuses } = require('../../../constants')

// ({Emitter, string, string, string}) => Promise<Boolean>
const handleSms = ({ sock, phoneNumber, senderPhoneNumber, message }) => {
  const [isVerificationCode, verificationCode] = signal.parseVerificationCode(message)
  return isVerificationCode
    ? registrationService.verify({ sock, phoneNumber, verificationCode })
    : respondToSms(phoneNumber, senderPhoneNumber)
}

// (String, String) -> SignalboostStatus
const respondToSms = (phoneNumber, senderPhoneNumber) => {
  // TODO(aguestuser|2020-05-03):
  //  - localize prompt based on country code
  //  - guard against flooding attacks by either of these (i prefer (2)):
  //    (1) persisting record of incomingPhoneNumber/hash(senderPhoneNumber), don't send if one already exists
  //    (2) keep count of number of sms'es on incoming phoneNumber, don't send if count exceeds K
  const prompToUseSignal =
    'This number only accepts messages sent with the Signal Private Messenger. Please install Signal from https://signal.org and try again.'
  const body = new MessagingResponse().message(prompToUseSignal).toString()
  return { status: statuses.SUCCESS, body }
}

module.exports = { handleSms, respondToSms }
