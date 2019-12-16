import { expect } from 'chai'
import { describe, it } from 'mocha'
import { commands } from '../../../../../app/services/dispatcher/commands/constants'
import { parseExecutable } from '../../../../../app/services/dispatcher/commands/parse'
import { languages } from '../../../../../app/constants'
import { defaultLanguage } from '../../../../../app/config'

describe('parsing commands', () => {
  describe('NOOP', () => {
    it('parses NOOP in any language if message does not begin with a command', () => {
      const msgs = [
        'fire the missiles',
        'do ADD foo',
        'do REMOVE foo',
        'do HELP',
        'do INFO',
        'do INVITE',
        'do HELLO',
        'do GOODBYE',
        'do RESPONSES ON',
        'do RESPONSES OFF',
        'do ENGLISH',
        'hace AGREGAR foo',
        'hace AYUDA',
        'hace INFO',
        'hace INVITAR',
        'hace HOLA',
        'hace ADIÓS',
        'hace ELIMINAR',
        'hace RENOMBRAR',
        'hace RESPUESTAS ACTIVADAS',
        'hace RESPUESTAS DESACTIVADAS',
        'hace ESPAÑOL',
      ]
      msgs.forEach(msg =>
        expect(parseExecutable(msg)).to.eql({
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
          expect(parseExecutable(msg)).to.eql({
            command: commands.ADD,
            language: languages.EN,
            payload: '',
          }),
        )
      })

      it('parses the payload from an ADD command', () => {
        expect(parseExecutable('ADD foo')).to.eql({
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
          expect(parseExecutable(msg)).to.eql({
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
          expect(parseExecutable(msg)).to.eql({
            command: commands.INFO,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('INVITE command', () => {
      it('parses an INVITE command (regardless of case or whitespace)', () => {
        const msgs = ['INVITE', 'invite', ' invite ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.INVITE,
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
          expect(parseExecutable(msg)).to.eql({
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
          expect(parseExecutable(msg)).to.eql({
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
          expect(parseExecutable(msg)).to.eql({
            command: commands.REMOVE,
            language: languages.EN,
            payload: '',
          }),
        )
      })

      it('parses the payload from an REMOVE command', () => {
        expect(parseExecutable('REMOVE foo')).to.eql({
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
            expect(parseExecutable(msg)).to.eql({
              command: commands.RENAME,
              language: languages.EN,
              payload: '',
            }),
          )
        })
      })

      it('parses the payload from an RENAME command', () => {
        expect(parseExecutable('RENAME foo')).to.eql({
          command: commands.RENAME,
          language: languages.EN,
          payload: 'foo',
        })
      })
    })

    describe('RESPONSES_ON command', () => {
      it('parses an RESPONSES_ON command (regardless of case or whitespace)', () => {
        const msgs = ['RESPONSES ON', 'responses on', ' responses  on ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.RESPONSES_ON,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('RESPONSES_OFF command', () => {
      it('parses an RESPONSES_OFF command (regardless of case or whitespace)', () => {
        const msgs = ['RESPONSES OFF', 'responses off', ' responses  off ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.RESPONSES_OFF,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('SET_LANGUAGE command', () => {
      it('sets the language to English regardless of language in which English is specified', () => {
        const msgs = ['ENGLISH', 'INGLÉS', 'INGLES', 'ANGLAIS', 'english', 'inglés', 'ingles']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.SET_LANGUAGE,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('VOUCHING_ON command', () => {
      it('parses VOUCHING_ON regardless of spacing, accents, casing, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['VOUCHING ON', ' vouching on '],
          },
          {
            language: languages.ES,
            messages: ['ATESTIGUANDO ACTIVADA', ' atestiguando activada '],
          },
          {
            language: languages.FR,
            messages: ['SE PORTER GARANT ACTIVÉES', ' se porter garant activees '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.VOUCHING_ON,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('VOUCHING_OFF command', () => {
      it('parses VOUCHING_OFF regardless of spacing, accents, casing, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['VOUCHING OFF', ' vouching off '],
          },
          {
            language: languages.ES,
            messages: ['ATESTIGUANDO DESACTIVADA', ' atestiguando desactivada '],
          },
          {
            language: languages.FR,
            messages: ['SE PORTER GARANT DÉSACTIVÉES', ' se porter garant desactivees '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.VOUCHING_OFF,
              language,
              payload: '',
            }),
          ),
        )
      })
    })
  })

  describe('in Spanish', () => {
    describe('ADD command', () => {
      it('parses an ADD command (regardless of case or whitespace)', () => {
        const msgs = ['AGREGAR', 'agregar', ' agregar ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.ADD,
            language: languages.ES,
            payload: '',
          }),
        )
      })

      it('parses the payload from an ADD command', () => {
        expect(parseExecutable('AGREGAR foo')).to.eql({
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
          expect(parseExecutable(msg)).to.eql({
            command: commands.HELP,
            language: languages.ES,
            payload: '',
          }),
        )
      })
    })

    describe('INFO command', () => {
      it('parses an INFO command but does NOT detect language', () => {
        const msgs = ['INFO', 'info', ' info ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.INFO,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('INVITE command', () => {
      it('parses an INVITE command (regardless of case or whitespace)', () => {
        const msgs = ['INVITAR', 'invitar', ' invitar ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.INVITE,
            language: languages.ES,
            payload: '',
          }),
        )
      })
    })

    describe('JOIN command', () => {
      it('parses an JOIN command from "hola"(regardless of case or whitespace)', () => {
        const msgs = ['HOLA', 'hola', ' hola ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.JOIN,
            language: languages.ES,
            payload: '',
          }),
        )
      })
    })

    describe('LEAVE command', () => {
      it('parses an LEAVE command from "ADIOS" (regardless of accents, case or whitespace)', () => {
        const msgs = ['ADIÓS', 'adiós', ' adiós ', 'ADIOS', 'adios', '  adios ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
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
          expect(parseExecutable(msg)).to.eql({
            command: commands.REMOVE,
            language: languages.ES,
            payload: '',
          }),
        )
      })

      it('parses the payload from an REMOVE command', () => {
        expect(parseExecutable('ELIMINAR foo')).to.eql({
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
            expect(parseExecutable(msg)).to.eql({
              command: commands.RENAME,
              language: languages.ES,
              payload: '',
            }),
          )
        })
      })

      it('parses the payload from an RENAME command', () => {
        expect(parseExecutable('RENOMBRAR foo')).to.eql({
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
            expect(parseExecutable(msg)).to.eql({
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
            expect(parseExecutable(msg)).to.eql({
              command: commands.RESPONSES_OFF,
              language: languages.ES,
              payload: '',
            }),
          )
        })
      })
    })

    describe('SET_LANGUAGE command', () => {
      it('sets the language to Spanish regardless of language in which English is specified', () => {
        const msgs = ['ESPAÑOL', 'ESPANOL', 'SPANISH', 'español', 'espanol', 'spanish']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.SET_LANGUAGE,
            language: languages.ES,
            payload: '',
          }),
        )
      })
    })
  })

  describe('in French', () => {
    describe('ADD command', () => {
      it('parses an ADD command (regardless of case or whitespace)', () => {
        const msgs = ['AJOUTER', 'ajouter', ' ajouter ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.ADD,
            language: languages.FR,
            payload: '',
          }),
        )
      })

      it('parses the payload from an ADD command', () => {
        expect(parseExecutable('AJOUTER foo')).to.eql({
          command: commands.ADD,
          language: languages.FR,
          payload: 'foo',
        })
      })
    })

    describe('HELP command', () => {
      it('parses an HELP command (regardless of case or whitespace)', () => {
        const msgs = ['AIDE', 'aide', ' aide ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.HELP,
            language: languages.FR,
            payload: '',
          }),
        )
      })
    })

    describe('INFO command', () => {
      it('parses an INFO command but does NOT detect language', () => {
        const msgs = ['INFO', 'info', ' info ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.INFO,
            language: languages.EN,
            payload: '',
          }),
        )
      })
    })

    describe('JOIN command', () => {
      it('parses an JOIN command from "hola"(regardless of case or whitespace)', () => {
        const msgs = ['ALLÔ', 'ALLO', 'allo', ' allo ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.JOIN,
            language: languages.FR,
            payload: '',
          }),
        )
      })
    })

    describe('LEAVE command', () => {
      it('parses an LEAVE command from "ADIOS" (regardless of accents, case or whitespace)', () => {
        const msgs = ['ADIEU', 'adieu', ' adieu ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.LEAVE,
            language: languages.FR,
            payload: '',
          }),
        )
      })
    })

    describe('REMOVE command', () => {
      it('parses a REMOVE command (regardless of case or whitespace)', () => {
        const msgs = ['SUPPRIMER', 'supprimer', ' supprimer ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.REMOVE,
            language: languages.FR,
            payload: '',
          }),
        )
      })

      it('parses the payload from an REMOVE command', () => {
        expect(parseExecutable('SUPPRIMER foo')).to.eql({
          command: commands.REMOVE,
          language: languages.FR,
          payload: 'foo',
        })
      })
    })

    describe('RENAME command', () => {
      it('parses an RENAME command (regardless of case or whitespace)', () => {
        const msgs = ['RENOMMER', 'renommer', ' renommer ']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.RENAME,
            language: languages.FR,
            payload: '',
          }),
        )
      })

      it('parses the payload from an RENAME command', () => {
        expect(parseExecutable('RENOMMER foo')).to.eql({
          command: commands.RENAME,
          language: languages.FR,
          payload: 'foo',
        })
      })
    })

    describe('RESPONSES_ON command', () => {
      it('parses an RESPONSES_ON command (regardless of case or whitespace)', () => {
        it('parses an RENAME command (regardless of case or whitespace)', () => {
          const msgs = ['RÉPONSES ACTIVÉES', 'REPONSES ACTIVEES', ' reponses activees ']
          msgs.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.RESPONSES_ON,
              language: languages.FR,
              payload: '',
            }),
          )
        })
      })
    })

    describe('RESPONSES_OFF command', () => {
      it('parses an RESPONSES_OFF command (regardless of case or whitespace)', () => {
        const msgs = ['RÉPONSES DÉSACTIVÉES', 'REPONSES DESACTIVEES', 'reponses desactivees']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.RESPONSES_OFF,
            language: languages.FR,
            payload: '',
          }),
        )
      })
    })

    describe('SET_LANGUAGE command', () => {
      it('sets the language to Spanish regardless of language in which English is specified', () => {
        const msgs = ['FRENCH', 'FRANÇAIS', 'FRANCAIS', 'FRANCESA']
        msgs.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.SET_LANGUAGE,
            language: languages.FR,
            payload: '',
          }),
        )
      })
    })
  })
})
