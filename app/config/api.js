const defaults = {
  host: process.env.SIGNALBOOST_HOST_URL,
  port: 3000,
  authToken: process.env.SIGNALBOOST_API_TOKEN,
}

const test = {
  ...defaults,
  authToken: 'fakeToken',
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
