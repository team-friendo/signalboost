const defaults = {
  host: 'signalboost.ngrok.io',
  port: 3000,
  authToken: process.env.SIGNALBOOST_API_TOKEN,
}

const production = {
  ...defaults,
  host: process.env.SIGNALBOOST_HOST_URL,
}

module.exports = {
  development: defaults,
  test: defaults,
  production,
}
