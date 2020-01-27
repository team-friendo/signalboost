/* eslint require-atomic-updates: 0 */
const phoneNumberService = require('./phoneNumber')
const channelRegistrar = require('./channel')
const { get, find } = require('lodash')
const {
  twilio: { smsEndpoint },
} = require('../../config/index')

const routesOf = (router, db, sock) => {
  router.get('/hello', async ctx => {
    ctx.body = { msg: 'hello world' }
  })

  router.get('/channels', async ctx => {
    const result = await channelRegistrar.list(db)
    ctx.status = httpStatusOf(get(result, 'status'))
    ctx.body = result.data
  })

  router.post('/channels', async ctx => {
    const { phoneNumber, name, admins } = ctx.request.body
    const result = await channelRegistrar.create({ db, sock, phoneNumber, name, admins })
    ctx.status = httpStatusOf(get(result, 'status'))
    ctx.body = result
  })

  router.post('/channels/admins', async ctx => {
    const { channelPhoneNumber, adminPhoneNumber } = ctx.request.body
    const result = await channelRegistrar.addAdmin({
      db,
      sock,
      channelPhoneNumber,
      adminPhoneNumber,
    })
    ctx.status = httpStatusOf(get(result, 'status'))
    ctx.body = result
  })

  router.get('/phoneNumbers', async ctx => {
    const filter = phoneNumberService.filters[ctx.query.filter] || null
    const phoneNumberList = await phoneNumberService.list(db, filter)
    ctx.status = httpStatusOf(phoneNumberList.status)
    ctx.body = phoneNumberList.data
  })

  router.post('/phoneNumbers', async ctx => {
    const { num, areaCode } = ctx.request.body
    const n = parseInt(num) || 1

    const phoneNumberStatuses = await phoneNumberService.provisionN({ db, sock, areaCode, n })
    ctx.status = httpStatusOfMany(phoneNumberStatuses)
    ctx.body = phoneNumberStatuses
  })

  router.post('/phoneNumbers/recycle', async ctx => {
    const { phoneNumbers } = ctx.request.body
    const result = await phoneNumberService.recycle({
      db,
      sock,
      phoneNumbers,
    })
    ctx.status = httpStatusOfMany(result)
    ctx.body = result
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
