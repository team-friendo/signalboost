const dest = 'org.asamk.Signal'
const path = '/org/asamk/Signal'

/*****************************************
  NOTE: Signal.SendMessage is overloaded and underdocumented.  

  Here are its two implementations:
  
  (1) message to multiple recipients:
      sendMessage(msg: string, attachments: string[], recipients: string[])
  
  (2) message to single recipient: 
      sendMessage(msg: string, attachments: string[], recipient: string)

*****************************************/

const methods = {
  sendMessage: `${dest}.sendMessage`
}

module.exports = { dest, path, methods }
