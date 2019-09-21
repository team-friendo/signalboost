const phoneNumberService = require('./phoneNumber')
const channelService = require('./channel')
const safetyNumberService = require('./safetyNumbers')
const { get, find } = require('lodash')
const {
  twilio: { smsEndpoint },
} = require('../../config/index')

const routesOf = (router, db, sock) => {
  router.get('/hello', async ctx => {
    ctx.body = { msg: 'hello world' }
  })

  router.get('/channels', async ctx => {
    const result = await channelService.list(db)
    ctx.status = httpStatusOf(get(result, 'status'))
    ctx.body = result.data
  })

  router.post('/channels', async ctx => {
    const { phoneNumber, name, publishers } = ctx.request.body

    const result = await channelService.create({ db, sock, phoneNumber, name, publishers })
    ctx.status = httpStatusOf(get(result, 'status'))
    ctx.body = result
  })

  router.get('/phoneNumbers', async ctx => {
    const filter = phoneNumberService.filters[ctx.query.filter] || null
    const phoneNumberList = await phoneNumberService.list(db, filter)
    ctx.status = httpStatusOf(phoneNumberList.status)
    ctx.body = phoneNumberList.data
  })

  router.post('/phoneNumbers/trust', async ctx => {
    const { memberPhoneNumber } = ctx.request.body
    const result = await safetyNumberService.trustAllForMember(db, sock, memberPhoneNumber)
    ctx.status = httpStatusOf(get(result, 'status'))
    ctx.body = result
  })

  router.post('/phoneNumbers', async ctx => {
    const { num, areaCode } = ctx.request.body
    const n = parseInt(num) || 1

    const phoneNumberStatuses = await phoneNumberService.provisionN({ db, sock, areaCode, n })
    ctx.status = httpStatusOfMany(phoneNumberStatuses)
    ctx.body = phoneNumberStatuses
  })

  router.post(`/${smsEndpoint}`, async ctx => {
    const { To: phoneNumber, Body: verificationMessage } = ctx.request.body
    await phoneNumberService
      .verify({ db, sock, phoneNumber, verificationMessage })
      .then(() => (ctx.status = 200))
      .catch(() => (ctx.status = 500))
  })
}

// HELPERS

const httpStatusOf = status => (status === phoneNumberService.statuses.ERROR ? 500 : 200)
const httpStatusOfMany = pnStatuses =>
  find(pnStatuses, pns => pns.status === phoneNumberService.statuses.ERROR) ? 500 : 200

module.exports = routesOf
