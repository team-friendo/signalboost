const { defaultLanguage } = require('../../config')

const run = async db => {
  console.log('--- Backfilling language fields...')

  const updates = await Promise.all([
    db.publications.update(...updateArgs),
    db.subscriptions.update(...updateArgs),
  ])

  const count = updates[0][0] + updates[1][0]

  return count === 0
    ? console.log('--- No backfills needed!')
    : console.log(`--- Backfilled ${count} records!`)
}

const updateArgs = [
  {
    language: defaultLanguage,
  },
  {
    where: { language: null },
  },
]
