const app = {
  socketPool: null,
}

app.run = async ({ socketPool, signal }) => {
  const socketService = socketPool || require('./socket')
  const signalService = signal || require('./signal')

  app.socketPool = await socketService.run().catch(logger.fatalError)

  const botPhoneNumbers = ['+12223334444']
  await signalService.run(botPhoneNumbers).catch(logger.fatalError)
}

module.exports = app
