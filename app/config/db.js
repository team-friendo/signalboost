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
  database: 'signalboost_development',
}

const test = {
  ...defaults,
  database: 'signalboost_test',
  connectionInterval: 10,
  maxConnectionAttempts: 10,
}

const production = {
  ...defaults,
  database: 'signalboost',
}

module.exports = {
  development,
  test,
  production,
}
