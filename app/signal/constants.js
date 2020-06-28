const messageTypes = {
  ERROR: 'unexpected_error',
  GET_IDENTITIES: 'get_identities',
  IDENTITIES: 'identities',
  MESSAGE: 'message',
  REGISTER: 'register',
  SEND: 'send',
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

module.exports = { messageTypes, trustLevels }
