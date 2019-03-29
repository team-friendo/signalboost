import { times, random, sample } from 'lodash'
import { statuses } from '../../../app/db/models/phoneNumber'

export const genPhoneNumber = () => '+1' + times(10, () => random(0, 9).toString()).join('')
export const genSid = () =>
  times(34, () =>
    sample(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f']),
  ).join()

export const phoneNumberFactory = attrs => ({
  phoneNumber: genPhoneNumber(),
  status: sample(statuses),
  twilioSid: genSid(),
  ...attrs,
})

export const twilioNumberCreationResponse = {
  accountSid: 'deadbeef',
  addressSid: null,
  addressRequirements: 'none',
  apiVersion: '2010-04-01',
  beta: false,
  capabilities: {
    voice: true,
    sms: true,
    mms: true,
    fax: false,
  },
  dateCreated: 'Thu, 03 Jan 2019 00:31:38 +0000',
  dateUpdated: 'Thu, 03 Jan 2019 00:31:38 +0000',
  friendlyName: 'signal-boost number 666f21aa-1f93-4fb3-aab2-c64770d19b22',
  identitySid: null,
  phoneNumber: '+16086403930',
  origin: 'twilio',
  sid: 'PN82868e4e46535bfef8c152c9a7b41e99',
  smsApplicationSid: '',
  smsFallbackMethod: 'POST',
  smsFallbackUrl: '',
  smsMethod: 'POST',
  smsUrl: 'https://foobar.com',
  statusCallback: '',
  statusCallbackMethod: 'POST',
  trunkSid: null,
  uri:
    '/2010-04-01/Accounts/AC3596f286e9c66c21c335f756eefedd83/IncomingPhoneNumbers/PN82868e4e46535bfef8c152c9a7b41e99.json',
  voiceApplicationSid: null,
  voiceCallerIdLookup: false,
  voiceFallbackMethod: 'POST',
  voiceFallbackUrl: null,
  voiceMethod: 'POST',
  voiceUrl: null,
  emergencyStatus: 'Inactive',
  emergencyAddressSid: null,
}
