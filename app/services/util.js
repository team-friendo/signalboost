const util = require('util')

const exec = util.promisify(require('child_process').exec)

const promisifyCallback = (resolve, reject) => (err, res) => {
  if (err) reject(err)
  else resolve(res)
}

module.exports = { exec, promisifyCallback }
