import { commands } from './constants'

// string -> Executable
const parseCommand = msg => {
  const _msg = msg.trim()
  if (_msg.match(/^add/i)) return { command: commands.ADD, payload: _msg.match(/^add\s?(.*)/i)[1] }
  else if (_msg.match(/^(help|ayuda)$/i)) return { command: commands.HELP }
  else if (_msg.match(/^info$/i)) return { command: commands.INFO }
  else if (_msg.match(/^(join|hello|hola)$/i)) return { command: commands.JOIN }
  else if (_msg.match(/^(leave|goodbye|adios)$/i)) return { command: commands.LEAVE }
  else if (_msg.match(/^remove/i))
    return { command: commands.REMOVE, payload: _msg.match(/^remove\s?(.*)$/i)[1] }
  else if (_msg.match(/^rename/i))
    return { command: commands.RENAME, payload: _msg.match(/^rename\s?(.*)$/i)[1] }
  else if (_msg.match(/^responses/i))
    return { command: commands.TOGGLE_RESPONSES, payload: _msg.match(/^responses\s?(.*)$/i)[1] }
  else return { command: commands.NOOP }
}

module.exports = { parseCommand }
