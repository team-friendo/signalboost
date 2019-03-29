const update = (db, phoneNumber, attrs) =>
  db.phoneNumber
    .update({ ...attrs }, { where: { phoneNumber }, returning: true })
    .then(([_, [pNumInstance]]) => pNumInstance)

const list = db => db.phoneNumber.findAll({ order: [['status', 'DESC']] })

module.exports = { update, list }
