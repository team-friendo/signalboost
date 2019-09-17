const { initDb } = require('../index')
const { sequence } = require('../../services/util')

// TODO(aguestuser|2019-09-08):
//  consider programatically importing all backfills in this dir if manually importing becomes cumbersome
const messageCountBackfill = require('./20190419175200-backfill-empty-message-counts-for-old-channels')
const languagesBackfill = require('./20190908233808-backfill-language-field-in-subscription-and-publication')
const backfills = [messageCountBackfill, languagesBackfill]

const db = initDb()
sequence(backfills.map(bf => bf.run(db)))
