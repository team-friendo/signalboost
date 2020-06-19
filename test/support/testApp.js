module.exports = {
  db: { initDb: () => Promise.resolve() },
  sock: { getSocket: () => Promise.resolve() },
  registrar: { run: () => Promise.resolve() },
  dispatcher: { run: () => Promise.resolve() },
}
