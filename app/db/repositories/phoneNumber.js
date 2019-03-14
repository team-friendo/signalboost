
// TODO: UNIT TEST!
// Database, String, PhoneNumberAttributes -> Promise<PhoneNumberInstance>
const update = (db, phoneNumber, attrs) =>
  db.phoneNumber
    .update({ ...attrs }, { where: { phoneNumber }, returning: true })
    .then(([_, [pNumInstance]]) => pNumInstance)

module.exports = { update }