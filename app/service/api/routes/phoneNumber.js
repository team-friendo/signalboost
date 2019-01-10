const phoneNumberService = require('../../phoneNumber')
const {
  twilio: { smsEndpoint },
} = require('../../../config')

const phoneNumberRoutes = (router, db, emitter) => {
  router.post('/phoneNumbers/provision', async ctx => {
    const { num, areaCode } = ctx.request.body
    const n = parseInt(num) || 1

    ctx.body = await phoneNumberService.provisionN({ db, emitter, areaCode, n })
  })

  router.post('/phoneNumbers/purchase', async ctx => {
    const { areaCode } = ctx.request.body
    const { status, phoneNumber, error } = await phoneNumberService.purchase({ db, areaCode })

    ctx.status = httpStatusOf(status)
    ctx.body = { status, phoneNumber, ...(error ? { error } : {}) }
  })

  router.post('/phoneNumbers/register', async ctx => {
    const { phoneNumber } = ctx.request.body
    const { status, error } = await phoneNumberService.register({ db, emitter, phoneNumber })

    ctx.status = httpStatusOf(status)
    ctx.body = { status, phoneNumber, ...(error ? { error } : {}) }
  })

  router.post(`/${smsEndpoint}`, async ctx => {
    const { To: phoneNumber, Body: verificationMessage } = ctx.request.body
    await phoneNumberService
      .verify({ db, emitter, phoneNumber, verificationMessage })
      .then(() => (ctx.status = 200))
      .catch(() => (ctx.status = 500))
  })
}

const httpStatusOf = status => (status === phoneNumberService.statuses.ERROR ? 500 : 200)

module.exports = phoneNumberRoutes
