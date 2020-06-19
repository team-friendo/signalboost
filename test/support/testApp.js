const defaultStub = {
  run: () =>
    Promise.resolve({
      stop: () => Promise.resolve(),
      sequelize: {
        transaction: () => ({
          commit: async () => Promise.resolve(),
          rollback: async () => Promise.resolve(),
        }),
      },
    }),
}

module.exports = {
  db: defaultStub,
  sock: defaultStub,
  registrar: defaultStub,
  dispatcher: defaultStub,
}
