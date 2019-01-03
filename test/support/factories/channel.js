const { genPhoneNumber } = require('./phoneNumber')

export const channelFactory = attrs => ({
  phoneNumber: genPhoneNumber(),
  name: '#red-alert',
  ...attrs,
})
