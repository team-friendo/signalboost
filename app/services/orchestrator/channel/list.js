const channelRepository = require('../../../db/repositories/channel')
const channelPresenter = require('../../../presenters/channel')
const statuses = require('../../../constants')

const list = db =>
  channelRepository
    .findAllDeep(db)
    .then(chs => ({
      status: statuses.SUCCESS,
      data: channelPresenter.list(chs),
    }))
    .catch(error => ({ status: statuses.ERROR, data: { error } }))

module.exports = { list }