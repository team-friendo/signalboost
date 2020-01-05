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
        'the ADD foo',
        'the ACCEPT',
        'the DECLINE',
        'the REMOVE foo',
        'the HELP',
        'the INFO',
        'the INVITE',
        'the HELLO',
        'the GOODBYE',
        'the RESPONSES ON',
        'the RESPONSES OFF',
        'the VOUCHING ON',
        'the VOUCHING OFF',
        'the ENGLISH',

        'la AGREGAR foo',
        'la ACEPTAR',
        'la AYUDA',
        'la INFO',
        'la INVITAR',
        'la HOLA',
        'la ADIÓS',
        'la ELIMINAR',
        'la RECHAZAR',
        'la RENOMBRAR',
        'la RESPUESTAS ACTIVADAS',
        'la RESPUESTAS DESACTIVADAS',
        'la ESPAÑOL',

        'le AJOUTER',
        'le ACCEPTER',
        'le REFUSER',
        'le AIDE',
        'le INFO',
        'le INVITER',
        'le ALLÔ',
        'le ADIEU',
        'le SUPPRIMER',
        'le RENOMMER',
        'le RÉPONSES ACTIVÉES',
        'le RÉPONSES DÉSACTIVÉES',
        'le SE PORTER GARANT ACTIVÉES',
        'le SE PORTER GARANT DÉSACTIVÉES',
        'le FRENCH',
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

  describe('ACCEPT command', () => {
    it('parses an ACCEPT command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['ACCEPT', ' accept '],
        },
        {
          language: languages.ES,
          messages: ['ACEPTAR', ' aceptar '],
        },
        {
          language: languages.FR,
          messages: ['ACCEPTER', ' accepter '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.ACCEPT,
            language,
            payload: '',
          }),
        ),
      )
    })
  })

  describe('ADD command', () => {
    it('parses an ADD command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['ADD', 'add', ' add '],
        },
        {
          language: languages.ES,
          messages: ['AGREGAR', 'agregar', ' agregar '],
        },
        {
          language: languages.FR,
          messages: ['AJOUTER', 'ajouter', ' ajouter '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.ADD,
            language,
            payload: '',
          }),
        ),
      )
    })

    it('parses the payload from an ADD command', () => {
      const variants = [
        {
          language: languages.EN,
          message: 'ADD foo',
        },
        {
          language: languages.ES,
          message: 'AGREGAR foo',
        },
        {
          language: languages.FR,
          message: 'AJOUTER foo',
        },
      ]
      variants.forEach(({ language, message }) =>
        expect(parseExecutable(message)).to.eql({
          command: commands.ADD,
          language,
          payload: 'foo',
        }),
      )
    })
  })

  describe('DECLINE command', () => {
    it('parses an DECLINE command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['DECLINE', ' decline '],
        },
        {
          language: languages.ES,
          messages: ['RECHAZAR', ' rechazar '],
        },
        {
          language: languages.FR,
          messages: ['REFUSER', ' refuser '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.DECLINE,
            language,
            payload: '',
          }),
        ),
      )
    })
  })

  describe('HELP command', () => {
    it('parses an HELP command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['HELP', 'help', ' help '],
        },
        {
          language: languages.ES,
          messages: ['AYUDA', 'ayuda', ' ayuda '],
        },
        {
          language: languages.FR,
          messages: ['AIDE', 'aide', ' aide '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.HELP,
            language,
            payload: '',
          }),
        ),
      )
    })
  })

  describe('INFO command', () => {
    it('parses an INFO command in EN regardless of language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['INFO', 'info', ' info '],
        },
      ]
      variants.forEach(({ messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.INFO,
            language: languages.EN,
            payload: '',
          }),
        ),
      )
    })
  })

  describe('INVITE command', () => {
    it('parses an INVITE command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['INVITE', 'invite', ' invite '],
        },
        {
          language: languages.ES,
          messages: ['INVITAR', 'invitar', ' invitar '],
        },
        {
          language: languages.FR,
          messages: ['INVITER', 'inviter', ' inviter '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.INVITE,
            language,
            payload: '',
          }),
        ),
      )
    })
  })

  describe('JOIN command', () => {
    it('parses an JOIN command from "hello" or "join" (regardless of case or whitespace)', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['HELLO', ' hello ', 'JOIN', '  join '],
        },
        {
          language: languages.ES,
          messages: ['HOLA', ' hola '],
        },
        {
          language: languages.FR,
          messages: ['ALLÔ', 'ALLO', ' allo '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.JOIN,
            language,
            payload: '',
          }),
        ),
      )
    })
  })

  describe('LEAVE command', () => {
    it('parses a LEAVE command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['GOODBYE', 'goodbye', ' goodbye ', 'LEAVE', 'leave', '  leave '],
        },
        {
          language: languages.ES,
          messages: ['ADIÓS', 'adiós', ' adiós ', 'ADIOS', 'adios', '  adios '],
        },
        {
          language: languages.FR,
          messages: ['ADIEU', 'adieu', ' adieu '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.LEAVE,
            language,
            payload: '',
          }),
        ),
      )
    })
  })

  describe('REMOVE command', () => {
    it('parses a REMOVE command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['REMOVE', 'remove', ' remove '],
        },
        {
          language: languages.ES,
          messages: ['ELIMINAR', 'eliminar', ' eliminar '],
        },
        {
          language: languages.FR,
          messages: ['SUPPRIMER', 'supprimer', ' supprimer '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.REMOVE,
            language,
            payload: '',
          }),
        ),
      )
    })

    it('parses the payload from a REMOVE command', () => {
      const variants = [
        {
          language: languages.EN,
          message: 'REMOVE foo',
        },
        {
          language: languages.ES,
          message: 'ELIMINAR foo',
        },
        {
          language: languages.FR,
          message: 'SUPPRIMER foo',
        },
      ]
      variants.forEach(({ language, message }) =>
        expect(parseExecutable(message)).to.eql({
          command: commands.REMOVE,
          language,
          payload: 'foo',
        }),
      )
    })
  })

  describe('RENAME command', () => {
    it('parses a RENAME command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['RENAME', ' rename '],
        },
        {
          language: languages.ES,
          messages: ['RENOMBRAR', 'renombrar', ' renombrar '],
        },
        {
          language: languages.FR,
          messages: ['RENOMMER', 'renommer', ' renommer '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.RENAME,
            language,
            payload: '',
          }),
        ),
      )
    })

    it('parses the payload from a RENAME command', () => {
      const variants = [
        {
          language: languages.EN,
          message: 'RENAME foo',
        },
        {
          language: languages.ES,
          message: 'RENOMBRAR foo',
        },
        {
          language: languages.FR,
          message: 'RENOMMER foo',
        },
      ]
      variants.forEach(({ language, message }) =>
        expect(parseExecutable(message)).to.eql({
          command: commands.RENAME,
          language,
          payload: 'foo',
        }),
      )
    })
  })

  describe('DESCRIPTION command', () => {
    it('parses a DESCRIPTION command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          lang: languages.EN,
          messages: ['DESCRIPTION', 'description', ' description '],
        },
        {
          lang: languages.ES,
          messages: ['DESCRIPCIÓN', 'DESCRIPCION', 'descripcion', ' descripcion '],
        },
        {
          lang: languages.FR,
          messages: ['DESCRIPTION', 'description', ' description '],
        },
      ]
      variants.forEach(({ lang, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.SET_DESCRIPTION,
            language: lang === languages.FR ? languages.EN : lang,
            payload: '',
          }),
        ),
      )
    })

    it('parses the payload from a DESCRIPTION command', () => {
      const variants = [
        {
          lang: languages.EN,
          message: 'DESCRIPTION foo channel description',
        },
        {
          lang: languages.ES,
          message: 'DESCRIPCIÓN foo channel description',
        },
        {
          lang: languages.FR,
          message: 'DESCRIPTION foo channel description',
        },
      ]
      variants.forEach(({ lang, message }) => {
        expect(parseExecutable(message)).to.eql({
          command: commands.SET_DESCRIPTION,
          language: lang === languages.FR ? languages.EN : lang,
          payload: 'foo channel description',
        })
      })
    })
  })

  describe('RESPONSES_ON command', () => {
    it('parses an RESPONSES_ON command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['RESPONSES ON', 'responses on', ' responses on '],
        },
        {
          language: languages.ES,
          messages: ['RESPUESTAS ACTIVADAS', 'respuestas activadas', ' respuestas activadas '],
        },
        {
          language: languages.FR,
          messages: ['RÉPONSES ACTIVÉES', 'REPONSES ACTIVEES', ' reponses activees '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.RESPONSES_ON,
            language,
            payload: '',
          }),
        ),
      )
    })
  })

  describe('RESPONSES_OFF command', () => {
    it('parses an RESPONSES_OFF command regardless of casing, spacing, accents, or language', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['RESPONSES OFF', ' responses off '],
        },
        {
          language: languages.ES,
          messages: ['RESPUESTAS DESACTIVADAS', ' respuestas desactivadas '],
        },
        {
          language: languages.FR,
          messages: ['RÉPONSES DÉSACTIVÉES', 'REPONSES DESACTIVEES', ' reponses desactivees '],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.RESPONSES_OFF,
            language,
            payload: '',
          }),
        ),
      )
    })
  })

  describe('SET_LANGUAGE command', () => {
    it('sets language regardless of language in which new language is specified', () => {
      const variants = [
        {
          language: languages.EN,
          messages: ['ENGLISH', 'INGLÉS', 'INGLES', 'ANGLAIS', 'english', 'inglés', 'ingles'],
        },
        {
          language: languages.ES,
          messages: ['ESPAÑOL', 'ESPANOL', 'SPANISH', 'español', 'espanol', 'spanish'],
        },
        {
          language: languages.FR,
          messages: ['FRENCH', 'FRANÇAIS', 'FRANCAIS', 'FRANCESA'],
        },
      ]
      variants.forEach(({ language, messages }) =>
        messages.forEach(msg =>
          expect(parseExecutable(msg)).to.eql({
            command: commands.SET_LANGUAGE,
            language,
            payload: '',
          }),
        ),
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
