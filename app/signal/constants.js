const messageTypes = {
  ABORT: 'abort',
  ERROR: 'unexpected_error',
  GET_IDENTITIES: 'get_identities',
  HEALTHCHECK: 'healthcheck',
  HEALTHCHECK_RESPONSE: 'healthcheck_response',
  IDENTITIES: 'identities',
  INBOUND_IDENTITY_FAILURE: 'inbound_identity_failure',
  MESSAGE: 'message',
  REGISTER: 'register',
  REGISTRATION_ERROR: 'registration_error',
  REGISTRATION_SUCCESS: 'registration_succeeded',
  SEND: 'send',
  SEND_RESULTS: 'send_results',
  SET_EXPIRATION: 'set_expiration',
  SUBSCRIBE: 'subscribe',
  TRUST: 'trust',
  TRUSTED_FINGERPRINT: 'trusted_fingerprint',
  UNTRUSTED_IDENTITY: 'untrusted_identity',
  UNREADABLE_MESSAGE: 'unreadable_message',
  UNSUBSCRIBE: 'unsubscribe',
  VERIFICATION_ERROR: 'verification_error',
  VERIFICATION_REQUIRED: 'verification_required',
  VERIFICATION_SUCCESS: 'verification_succeeded',
  VERIFY: 'verify',
  VERSION: 'version',
}

const trustLevels = {
  TRUSTED_VERIFIED: 'TRUSTED_VERIFIED',
  TRUSTED_UNVERIFIED: 'TRUSTED_UNVERIFIED',
  UNTRUSTED: 'UNTRUSTED',
}

// ({ sender: string, recipient?: string, message: string, attachments: Array<SignaldOutboundAttachment> | null }) => SignaldOutboundMessage
// `sender` and `recipient` are both e164 phone numbers
const sdMessageOf = ({ sender, recipient, message, attachments }) => ({
  type: messageTypes.SEND,
  username: sender,
  recipientAddress: { number: recipient },
  messageBody: message,
  attachments: attachments || [],
})

const sdRecipientAddressOf = number => ({
  number,
})

module.exports = { messageTypes, trustLevels, sdMessageOf, sdRecipientAddressOf }
