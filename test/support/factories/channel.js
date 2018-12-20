const { phoneNumberFactory } = require('./phoneNumber')

export const channelFactory = attrs => ({
  phoneNumber: phoneNumberFactory(),
  name: '#red-alert',
  ...attrs,
})
