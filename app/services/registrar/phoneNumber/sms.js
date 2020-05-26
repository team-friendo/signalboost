const signal = require('../../signal')
const registrationService = require('./register')
const smsSenderRepository = require('../../../db/repositories/smsSender')
const { statuses } = require('../../../services/util')
const {
  twiml: { MessagingResponse },
} = require('twilio')

// TODO: extract this to localized string!
const reachedQuotaError = 'Sender exceeded monthly sms quota.'
const prompToUseSignal =
  'This number only accepts messages sent with the Signal Private Messenger. Please install Signal from https://signal.org and try again.'

// ({Database, EventEmitter, string, string, string}) => Promise<Boolean>
const handleSms = ({ db, sock, phoneNumber, senderPhoneNumber, message }) => {
  const [isVerificationCode, verificationCode] = signal.parseVerificationCode(message)
  return isVerificationCode
    ? registrationService.verify({ sock, phoneNumber, verificationCode })
    : respondToSms(db, senderPhoneNumber)
}

// (String, String) -> SignalboostStatus
const respondToSms = async (db, senderPhoneNumber) => {
  // TODO(aguestuser|2020-05-03): localize prompt based on country code
  try {
    if (await smsSenderRepository.hasReachedQuota(db, senderPhoneNumber))
      return { status: statuses.ERROR, message: reachedQuotaError }

    await smsSenderRepository.countMessage(db, senderPhoneNumber)
    const message = new MessagingResponse().message(prompToUseSignal).toString()
    return { status: statuses.SUCCESS, message }
  } catch (e) {
    return { status: statuses.ERROR, message: `Database error: ${e}` }
  }
}

module.exports = { handleSms, respondToSms, prompToUseSignal, reachedQuotaError }
