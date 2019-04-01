const phoneNumberService = require('./phoneNumber/index')
const channelService = require('./channel/index')
const { get, find } = require('lodash')
const {
  statuses: { PURCHASED },
} = phoneNumberService
const {
  twilio: { smsEndpoint },
} = require('../../config/index')

const routesOf = (router, db, emitter) => {
  // TODO: implement these...
  // router.get('/channels')

  router.get('/hello', async ctx => {
    ctx.body = { msg: 'hello world' }
  })

  router.post('/channels', async ctx => {
    const { phoneNumber, name, admins } = ctx.request.body

    const result = await channelService.activate({ db, phoneNumber, name, admins })
    ctx.status = httpStatusOf(get(result, 'status'))
    ctx.body = result
  })

  router.get('/phoneNumbers', async ctx => {
    const filter = phoneNumberService.filters[ctx.query.filter] || null
    const phoneNumberList = await phoneNumberService.list(db, filter)
    ctx.status = httpStatusOf(phoneNumberList.status)
    ctx.body = phoneNumberList
  })

  router.post('/phoneNumbers', async ctx => {
    const { num, areaCode } = ctx.request.body
    const n = parseInt(num) || 1

    const phoneNumberStatuses = await phoneNumberService.provisionN({ db, emitter, areaCode, n })
    ctx.status = httpStatusOfMany(phoneNumberStatuses)
    ctx.body = phoneNumberStatuses
  })

  router.post('/phoneNumbers/register', async ctx => {
    const phoneNumberStatuses = await phoneNumberService.registerAll({
      db,
      emitter,
      filter: { status: PURCHASED },
    })
    ctx.status = httpStatusOfMany(phoneNumberStatuses)
    ctx.body = phoneNumberStatuses
  })

  router.post(`/${smsEndpoint}`, async ctx => {
    const { To: phoneNumber, Body: verificationMessage } = ctx.request.body
    await phoneNumberService
      .verify({ db, emitter, phoneNumber, verificationMessage })
      .then(() => (ctx.status = 200))
      .catch(() => (ctx.status = 500))
  })
}

// HELPERS

const httpStatusOf = status => (status === phoneNumberService.statuses.ERROR ? 500 : 200)
const httpStatusOfMany = pnStatuses =>
  find(pnStatuses, pns => pns.status === phoneNumberService.statuses.ERROR) ? 500 : 200

module.exports = routesOf
