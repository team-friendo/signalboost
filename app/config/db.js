const defaults = {
  host: process.env.DB_HOST || 'localhost',
  dialect: 'postgres',
  logging: false,
  username: 'postgres',
  password: null,
  connectionInterval: 100,
  maxConnectionAttempts: 100,
}

const development = {
  ...defaults,
  database: process.env.SIGNALBOOST_DEV_DB_NAME || 'signalboost_development',
}

const test = {
  ...defaults,
  database: process.env.SIGNALBOOST_TEST_DB_NAME || 'signalboost_test',
  connectionInterval: 10,
  maxConnectionAttempts: 10,
}

const production = {
  ...defaults,
  database: process.env.SIGNALBOOST_DB_NAME || 'signalboost',
}

module.exports = {
  development,
  test,
  production,
}
