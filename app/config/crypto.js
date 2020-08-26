const defaults = {
  hashSalt: process.env.SIGNALBOOST_HASH_SALT,
}

const test = {
  hashSalt: '483157e72a4c17227f1feb2d437430eecb9f72b0a8691ab38c121d217f95518f',
}

module.exports = {
  development: defaults,
  test,
  production: defaults,
}
