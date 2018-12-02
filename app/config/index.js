import { get } from 'lodash'
const dbConfigsByEnv = require('./db.json')

const getConfig = cfg => get(cfg, [process.env.NODE_ENV || 'production'])

module.exports = {
  db: getConfig(dbConfigsByEnv)
}