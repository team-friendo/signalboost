import { expect } from 'chai'
import { describe, it } from 'mocha'
import { commands } from '../../../../../app/services/dispatcher/commands/constants'
import { parseCommand } from '../../../../../app/services/dispatcher/commands/parse'
import { languages } from '../../../../../app/constants'
import { defaultLanguage } from '../../../../../app/config'

describe('parsing commands', () => {
  describe('NOOP', () => {
    it('parses NOOP in any language if message does not begin with a command', () => {
      const msgs = [
        'do ADD foo',
        'do REMOVE foo',
        'do HELP',
        'do INFO',
        'do HELLO',
        'do GOODBYE',
        'do RESPONSES ON',
        'do RESPONSES OFF',
        'hace AGREGAR foo',
        'fire the missiles',
      ]
      msgs.forEach(msg =>
        expect(parseCommand(msg)).to.eql({
          command: commands.NOOP,
          language: defaultLanguage,
          payload: '',
        }),
      )
    })
  })

  describe('in English', () => {
    describe('ADD command', () => {
      it('parses an ADD command (regardless of case or whitespace)', () => {
        const msgs = ['ADD', 'add', ' add ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.ADD,
            language: languages.EN,
            payload: '',
          }),
        )
      })

      it('parses the payload from an ADD command', () => {
        expect(parseCommand('ADD foo')).to.eql({
          command: commands.ADD,
          language: languages.EN,
          payload: 'foo',
        })
      })
    })

    describe('HELP command', () => {
      it('parses a HELP command (regardless of case or whitespace)', () => {
        const msgs = ['HELP', 'help', ' help ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.HELP,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('INFO command', () => {
      it('parses an INFO command (regardless of case or whitespace)', () => {
        const msgs = ['INFO', 'info', ' info ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.INFO,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('JOIN command', () => {
      it('parses an JOIN command from "hello" or "join" (regardless of case or whitespace)', () => {
        const msgs = ['HELLO', 'hello', ' hello ', 'JOIN', 'join', '  join ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.JOIN,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('LEAVE command', () => {
      it('parses an LEAVE command from "goodbye" or "leave" (regardless of case or whitespace)', () => {
        const msgs = ['GOODBYE', 'goodbye', ' goodbye ', 'LEAVE', 'leave', '  leave ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.LEAVE,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('REMOVE command', () => {
      it('parses an REMOVE command (regardless of case or whitespace)', () => {
        const msgs = ['REMOVE', 'remove', ' remove ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.REMOVE,
            language: languages.EN,
            payload: '',
          }),
        )
      })

      it('parses the payload from an REMOVE command', () => {
        expect(parseCommand('REMOVE foo')).to.eql({
          command: commands.REMOVE,
          language: languages.EN,
          payload: 'foo',
        })
      })
    })

    describe('RENAME command', () => {
      it('parses an RENAME command (regardless of case or whitespace)', () => {
        it('parses an RENAME command (regardless of case or whitespace)', () => {
          const msgs = ['RENAME', 'rename', ' rename ']
          msgs.forEach(msg =>
            expect(parseCommand(msg)).to.eql({
              command: commands.RENAME,
              language: languages.EN,
              payload: '',
            }),
          )
        })
      })

      it('parses the payload from an RENAME command', () => {
        expect(parseCommand('RENAME foo')).to.eql({
          command: commands.RENAME,
          language: languages.EN,
          payload: 'foo',
        })
      })
    })

    describe('RESPONSES_ON command', () => {
      it('parses an RESPONSES_ON command (regardless of case or whitespace)', () => {
        it('parses an RENAME command (regardless of case or whitespace)', () => {
          const msgs = ['RESPONSES ON', 'responses on', ' responses  on ']
          msgs.forEach(msg =>
            expect(parseCommand(msg)).to.eql({
              command: commands.RESPONSES_ON,
              language: languages.EN,
              payload: '',
            }),
          )
        })
      })
    })

    describe('RESPONSES_OFF command', () => {
      it('parses an RESPONSES_OFF command (regardless of case or whitespace)', () => {
        it('parses an RENAME command (regardless of case or whitespace)', () => {
          const msgs = ['RESPONSES OFF', 'responses off', ' responses  off ']
          msgs.forEach(msg =>
            expect(parseCommand(msg)).to.eql({
              command: commands.RESPONSES_OFF,
              language: languages.EN,
              payload: '',
            }),
          )
        })
      })
    })
  })

  describe('in Spanish', () => {
    describe('ADD command', () => {
      it('parses an ADD command (regardless of case or whitespace)', () => {
        const msgs = ['AGREGAR', 'agregar', ' agregar ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.ADD,
            language: languages.ES,
            payload: '',
          }),
        )
      })

      it('parses the payload from an ADD command', () => {
        expect(parseCommand('AGREGAR foo')).to.eql({
          command: commands.ADD,
          language: languages.ES,
          payload: 'foo',
        })
      })
    })

    describe('HELP command', () => {
      it('parses an HELP command (regardless of case or whitespace)', () => {
        const msgs = ['AYUDA', 'ayuda', ' ayuda ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.HELP,
            language: languages.ES,
            payload: '',
          }),
        )
      })
    })

    describe('INFO command', () => {
      //TODO(aguestuser|2019-11-17):
      // - worth fixing fact that lang not detected?
      // - would require disambiguating btw/ INFO / INFORMACION
      //   and wouldn't necessarily always work for all commands in all langs
      // - current state not horrible b/c we should have language stored on member
      // - but also: maybe throw away the language if it is sometimes wrong?
      it('parses an INFO command but does NOT detect language', () => {
        const msgs = ['INFO', 'info', ' info ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.INFO,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('JOIN command', () => {
      it('parses an JOIN command from "hola"(regardless of case or whitespace)', () => {
        const msgs = ['HOLA', 'hola', ' hola ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.JOIN,
            language: languages.ES,
            payload: '',
          }),
        )
      })
    })

    it('parses an LEAVE command from "ADIOS" (regardless of accents, case or whitespace)', () => {
      const msgs = ['ADIÓS', 'adiós', ' adiós ', 'ADIOS', 'adios', '  adios ']
      msgs.forEach(msg =>
        expect(parseCommand(msg)).to.eql({
          command: commands.LEAVE,
          language: languages.ES,
          payload: '',
        }),
      )
    })
  })

  describe('REMOVE command', () => {
    it('parses a REMOVE command (regardless of case or whitespace)', () => {
      const msgs = ['ELIMINAR', 'eliminar', ' eliminar ']
      msgs.forEach(msg =>
        expect(parseCommand(msg)).to.eql({
          command: commands.REMOVE,
          language: languages.ES,
          payload: '',
        }),
      )
    })

    it('parses the payload from an REMOVE command', () => {
      expect(parseCommand('ELIMINAR foo')).to.eql({
        command: commands.REMOVE,
        language: languages.ES,
        payload: 'foo',
      })
    })
  })

  describe('RENAME command', () => {
    it('parses an RENAME command (regardless of case or whitespace)', () => {
      it('parses an RENAME command (regardless of case or whitespace)', () => {
        const msgs = ['RENOMBRAR', 'renombrar', ' renombrar ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.RENAME,
            language: languages.ES,
            payload: '',
          }),
        )
      })
    })

    it('parses the payload from an RENAME command', () => {
      expect(parseCommand('RENOMBRAR foo')).to.eql({
        command: commands.RENAME,
        language: languages.ES,
        payload: 'foo',
      })
    })
  })

  describe('RESPONSES_ON command', () => {
    it('parses an RESPONSES_ON command (regardless of case or whitespace)', () => {
      it('parses an RENAME command (regardless of case or whitespace)', () => {
        const msgs = ['RESPUESTAS ACTIVADAS', 'respuestas activadas', ' respuestas  activadas ']
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.RESPONSES_ON,
            language: languages.ES,
            payload: '',
          }),
        )
      })
    })
  })

  describe('RESPONSES_OFF command', () => {
    it('parses an RESPONSES_OFF command (regardless of case or whitespace)', () => {
      it('parses an RENAME command (regardless of case or whitespace)', () => {
        const msgs = [
          'RESPUESTAS DESACTIVADAS',
          'respuestas desactivadas',
          ' respuestas  desactivadas ',
        ]
        msgs.forEach(msg =>
          expect(parseCommand(msg)).to.eql({
            command: commands.RESPONSES_OFF,
            language: languages.ES,
            payload: '',
          }),
        )
      })
    })
  })
})
