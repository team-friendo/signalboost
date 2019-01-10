const defaults = {
  host: 'signalboost.ngrok.io',
  port: 3000,
  authToken: process.env.SIGNAL_BOOST_API_TOKEN,
}

const production = {
  ...defaults,
  host: process.env.HOST_IP,
}

module.exports = {
  development: defaults,
  test: defaults,
  production,
}
