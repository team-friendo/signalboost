const { sendMessage } = require('./signalDbusInterface.js')

const relay = async (msg, recipients) =>
  sendMessage(msg, recipients)
    .then(() => `--- SUCCESS: Relayed message "${msg}" to [${recipients}]`)
    .catch(err => console.error(`--- TRANSMISSION ERROR: ${err}`))

/************************************************
  NOTES:

  (1) in future iterations: consider only sending one message at a time

      (this would assist with rate limiting and make a more straighforward message
       interface over channels)

  (2) if we handled the result in the `then` block of `relay` we would have access to:

      - method_return_time: float(err, res) => console.log('err: ', err); console.log('res: ', res) }
      - sender: float
      - destination: float
      - seriai: int
      - reply_serial: int

*****************************************/

module.exports = relay
