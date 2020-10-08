const defaults = {
  maintainerPassphrase: (process.env.SIGNALBOOST_MAINTAINER_PASSPHRASE || '').replace(/"/g, ''),
}

const development = {
  ...defaults,
  maintainerPassphrase: defaults.maintainerPassphrase || 'slithy toves',
}

const test = {
  ...defaults,
  maintainerPassphrase: 'slithy toves',
}

module.exports = {
  development,
  test,
  production: defaults,
}
