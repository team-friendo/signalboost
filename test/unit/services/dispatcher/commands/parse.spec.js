import { expect } from 'chai'
import { describe, it } from 'mocha'
import { commands } from '../../../../../app/services/dispatcher/commands/constants'
import { parseExecutable } from '../../../../../app/services/dispatcher/commands/parse'
import { languages } from '../../../../../app/services/language'
import { defaultLanguage } from '../../../../../app/config'
import { messagesIn } from '../../../../../app/services/dispatcher/strings/messages'

describe('parse module', () => {
  const rawPhoneNumber = '+1 (222) 333-4444'
  const e164PhoneNumber = '+12223334444'
  const rawPhoneNumber2 = '+1 (444) 333-2222'
  const e164PhoneNumber2 = '+14443332222'
  const invalidPhoneNumber = '222-333-4444'

  describe('parsing commands', () => {
    describe('NOOP', () => {
      it('parses NOOP in any language if message does not begin with a command', () => {
        const msgs = [
          'fire the missiles',
          'the ADD foo',
          'the ACCEPT',
          'the DECLINE',
          'the DESTROY',
          'the REMOVE foo',
          'the HELP',
          'the INFO',
          'the INVITE',
          'the HELLO',
          'the GOODBYE',
          'the HOTLINE ON',
          'the HOTLINE OFF',
          'the VOUCH LEVEL',
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
          'la QUITAR',
          'la RECHAZAR',
          'la RENOMBRAR',
          'la LÍNEA DIRECTA',
          'la LÍNEA DIRECTA',
          'la NIVEL DE ATESTIGUAR',
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
          'le HOTLINE ACTIVÉE',
          'le HOTLINE DÉSACTIVÉE',
          'le NIVEAU DE PORTER GARANT',
          'le SE PORTER GARANT ACTIVÉES',
          'le SE PORTER GARANT DÉSACTIVÉES',
          'le FRENCH',

          'foo ANNEHMEN',
          'foo HINZUFÜGEN',
          'foo ABLEHNEN',
          'foo VERNICHTEN',
          'foo HILFE',
          'foo HOTLINE AN',
          'foo HOTLINE AUS',
          'foo EINLADEN',
          'foo HALLO',
          'foo TSCHÜSS',
          'foo ENTFERNEN',
          'foo UMBENENNEN',
          'foo BESCHREIBUNG',
          'foo VERTRAUENS-LEVEL',
          'foo VERTRAUEN AN',
          'foo VERTRAUEN EIN',
          'foo VERTRAUEN AUS',
          'foo DEUTSCH',
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
          {
            language: languages.DE,
            messages: ['ANNEHMEN', ' annehmen '],
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
      it('parses an ADD command and payload regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [`ADD ${e164PhoneNumber}`, ` add ${e164PhoneNumber}`],
          },
          {
            language: languages.ES,
            messages: [`AGREGAR ${e164PhoneNumber}`, ` agregar ${e164PhoneNumber}`],
          },
          {
            language: languages.FR,
            messages: [`AJOUTER ${e164PhoneNumber}`, ` ajouter ${e164PhoneNumber}`],
          },
          {
            language: languages.DE,
            messages: [
              `HINZUFÜGEN ${e164PhoneNumber}`,
              `HINZUFUEGEN ${e164PhoneNumber}`,
              `HINZUFUGEN ${e164PhoneNumber}`,
              `DAZU ${e164PhoneNumber}`,
              ` dazu ${e164PhoneNumber} `,
            ],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.ADD,
              language,
              payload: e164PhoneNumber,
            }),
          ),
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
          {
            language: languages.DE,
            messages: ['ABLEHNEN', ' ablehnen '],
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

    describe('DESTROY command', () => {
      it('parses an DESTROY command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['DESTROY', ' destroy '],
          },
          {
            language: languages.ES,
            messages: ['DESTRUIR', ' destruir '],
          },
          {
            language: languages.FR,
            messages: ['DÉTRUIRE', ' détruire '],
          },
          {
            language: languages.DE,
            messages: ['VERNICHTEN', ' vernichten '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.DESTROY,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('DESTROY_CONFIRM command', () => {
      it('parses an DESTROY_CONFIRM command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['CONFIRM DESTROY', ' confirm destroy '],
          },
          {
            language: languages.ES,
            messages: ['CONFIRMAR DESTRUIR', ' confirmar destruir '],
          },
          {
            language: languages.FR,
            messages: ['CONFIRMER DÉTRUIRE', ' confirmer détruire '],
          },
          {
            language: languages.DE,
            messages: ['BESTÄTIGEN VERNICHTEN', ' bestätigen vernichten '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.DESTROY_CONFIRM,
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
          {
            language: languages.DE,
            messages: ['HILFE', ' hilfe '],
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
            messages: [
              `INVITE ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` invite ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
          {
            language: languages.ES,
            messages: [
              `INVITAR ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` invitar ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
          {
            language: languages.FR,
            messages: [
              `INVITER ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` inviter ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
          {
            language: languages.DE,
            messages: [
              `EINLADEN ${e164PhoneNumber}, ${e164PhoneNumber2}`,
              ` einladen ${e164PhoneNumber}, ${e164PhoneNumber2} `,
            ],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.INVITE,
              language,
              payload: [e164PhoneNumber, e164PhoneNumber2],
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
            messages: [
              'HELLO',
              ' hello ',
              'hello.',
              'hello!',
              'hello!!!',
              'JOIN',
              ' join ',
              ' hi ',
              ' heya ',
              ' hey there ',
              ' whassup ',
            ],
          },
          {
            language: languages.ES,
            messages: ['HOLA', ' hola '],
          },
          {
            language: languages.FR,
            messages: ['ALLÔ', 'ALLO', ' allo '],
          },
          {
            language: languages.DE,
            messages: ['HALLO', ' hallo '],
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
          {
            language: languages.DE,
            messages: ['TSCHÜSS', 'TSCHUESS', 'TSCHÜß', 'TSCHUSS', 'TSCHUß', 'CIAO', ' tschuss '],
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
      it('parses a REMOVE command and payload regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [`REMOVE ${e164PhoneNumber}`, ` remove ${e164PhoneNumber}`],
          },
          {
            language: languages.ES,
            messages: [`QUITAR ${e164PhoneNumber}`, `quitar ${e164PhoneNumber}`],
          },
          {
            language: languages.FR,
            messages: [`SUPPRIMER ${e164PhoneNumber}`, ` supprimer ${e164PhoneNumber}`],
          },
          {
            language: languages.DE,
            messages: [`ENTFERNEN ${e164PhoneNumber}`, ` entfernen ${e164PhoneNumber} `],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.REMOVE,
              language,
              payload: e164PhoneNumber,
            }),
          ),
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
          {
            language: languages.DE,
            messages: ['UMBENENNEN', ' umbenennen '],
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
          {
            language: languages.DE,
            message: 'UMBENENNEN foo',
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
          {
            lang: languages.DE,
            messages: ['BESCHREIBUNG', ' beschreibung '],
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
          {
            lang: languages.DE,
            message: 'BESCHREIBUNG foo channel description',
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

      it('parses a multi-line description', () => {
        const message = 'DESCRIPTION foo channel\ndescription'

        expect(parseExecutable(message)).to.eql({
          command: commands.SET_DESCRIPTION,
          language: languages.EN,
          payload: 'foo channel\ndescription',
        })
      })
    })

    describe('HOTLINE_ON command', () => {
      it('parses a HOTLINE ON command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['HOTLINE ON', 'hotline on', ' hotline on '],
          },
          {
            language: languages.ES,
            messages: [
              'LÍNEA DIRECTA ACTIVADA',
              'línea directa activada',
              ' linea directa activada ',
            ],
          },
          {
            language: languages.FR,
            messages: ['HOTLINE ACTIVÉE', 'hotline activée', ' hotline activee '],
          },
          {
            language: languages.DE,
            messages: ['HOTLINE AN', ' hotline an '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.HOTLINE_ON,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('HOTLINE_OFF command', () => {
      it('parses an HOTLINE_OFF command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['HOTLINE OFF', ' hotline off '],
          },
          {
            language: languages.ES,
            messages: [
              'LÍNEA DIRECTA DESACTIVADA',
              'línea directa desactivada',
              ' Linea directa desactivada ',
            ],
          },
          {
            language: languages.FR,
            messages: ['HOTLINE DÉSACTIVÉE', 'hotline désactivée', ' hotline desactivee '],
          },
          {
            language: languages.DE,
            messages: ['HOTLINE AUS', ' hotline aus '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.HOTLINE_OFF,
              language,
              payload: '',
            }),
          ),
        )
      })
    })

    describe('REPLY command', () => {
      it('parses a REPLY command regardless of casing, spacing, accents, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: ['REPLY #1312', ' reply #1312 '],
          },
          {
            language: languages.ES,
            messages: ['RESPONDER #1312', ' responder #1312 '],
          },
          {
            language: languages.FR,
            messages: ['RÉPONDRE #1312', 'REPONDRE #1312', ' repondre #1312 '],
          },
          {
            language: languages.DE,
            messages: ['ANTWORTEN #1312', ' antworten #1312 '],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.REPLY,
              language,
              payload: {
                messageId: 1312,
                reply: '',
              },
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
            messages: ['ENGLISH', 'INGLÉS', 'INGLES', 'ANGLAIS', 'ENGLISCH', ' english '],
          },
          {
            language: languages.ES,
            messages: ['ESPAÑOL', 'ESPANOL', 'SPANISH', 'SPANISCH', ' spanish '],
          },
          {
            language: languages.FR,
            messages: [
              'FRENCH',
              'FRANÇAIS',
              'FRANCAIS',
              'FRANCESA',
              'FRANZÖSISCH',
              'FRANZOESISCH',
              ' french ',
            ],
          },
          {
            language: languages.DE,
            messages: ['GERMAN', 'DEUTSCH', 'ALLEMAND', 'ALEMAN', 'ALEMÁN', ' german '],
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
            messages: ['SE PORTER GARANT ACTIVÉE', ' se porter garant activee '],
          },
          {
            language: languages.DE,
            messages: ['VERTRAUEN AN', 'VERTRAUEN EIN', ' vertrauen an '],
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
            messages: ['SE PORTER GARANT DÉSACTIVÉE', ' se porter garant desactivee '],
          },
          {
            language: languages.DE,
            messages: ['VERTRAUEN AUS', ' vertrauen aus '],
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

    describe('VOUCH_LEVEL command', () => {
      const vouchLevel = 3

      it('parses a VOUCH LEVEL regardless of spacing, accents, casing, or language', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [`VOUCH LEVEL ${vouchLevel}`, ` vouch Level ${vouchLevel}`],
          },
          {
            language: languages.ES,
            messages: [`NIVEL DE ATESTIGUAR ${vouchLevel}`, ` nivel de atestiguar ${vouchLevel}`],
          },
          {
            language: languages.FR,
            messages: [
              `NIVEAU DE PORTER GARANT ${vouchLevel}`,
              ` niveau de porter garant${vouchLevel}`,
            ],
          },
          {
            language: languages.DE,
            messages: [`VERTRAUENS-LEVEL ${vouchLevel}`, ` vertrauens-level ${vouchLevel}`],
          },
        ]
        variants.forEach(({ language, messages }) =>
          messages.forEach(msg =>
            expect(parseExecutable(msg)).to.eql({
              command: commands.VOUCH_LEVEL,
              language,
              payload: `${vouchLevel}`,
            }),
          ),
        )
      })
    })
  })

  describe('validating payloads', () => {
    describe('a no-payload command followed by a payload', () => {
      it('is parsed as a broadcast message', () => {
        const variants = [
          {
            language: languages.EN,
            messages: [
              'accept foo',
              'decline foo',
              'help foo',
              'hello foo',
              'info foo',
              'join foo',
              'leave foo',
              'goodbye foo',
              'english foo',
              'hotline on now',
              'hotline off now',
              'vouching on now',
              'vouching off now',
            ],
          },
          {
            language: languages.ES,
            messages: [
              'aceptar foo',
              'rechazar foo',
              'ayuda foo',
              'hola foo',
              'adios foo',
              'espanol foo',
              'línea directa activada ahora',
              'línea directa desactivada ahora',
              'atestiguando activada ahora',
              'atestiguando desactivada ahora',
            ],
          },
          {
            language: languages.FR,
            messages: [
              'accepter foo',
              'refuser foo',
              'aide foo',
              'allo foo',
              'adieu foo',
              'francais foo',
              'hotline activee maintenant',
              'hotline desactivee maintenant',
              'se porter garant activees maintenant',
              'se porter garant desactivees maintenant',
            ],
          },
          {
            language: languages.DE,
            messages: [
              'ANNEHMEN foo',
              'ABLEHNEN foo',
              'HILFE foo',
              'HALLO foo',
              'TSCHÜSS foo',
              'DEUTSCH foo',
              'HOTLINE AN foo',
              'HOTLINE AUS foo',
              'VERTRAUEN AN foo',
              'VERTRAUEN EIN foo',
              'VERTRAUEN AUS foo',
            ],
          },
        ]

        variants.forEach(({ language, messages }) =>
          messages.forEach(msg => {
            expect(parseExecutable(msg)).to.eql({
              command: commands.NOOP,
              language,
              payload: '',
            })
          }),
        )
      })
    })

    describe('a phone number payload', () => {
      describe('when phone number is valid', () => {
        it('returns a command match with e164-formatted number in payload', () => {
          const variants = [
            {
              language: languages.EN,
              messages: [`add ${rawPhoneNumber}`, `remove ${rawPhoneNumber}`],
            },
            {
              language: languages.ES,
              messages: [`agregar ${rawPhoneNumber}`, `quitar ${rawPhoneNumber}`],
            },
            {
              language: languages.FR,
              messages: [`ajouter ${rawPhoneNumber}`, `supprimer ${rawPhoneNumber}`],
            },
            {
              language: languages.DE,
              messages: [`HINZUFÜGEN ${rawPhoneNumber}`, `ENTFERNEN ${rawPhoneNumber}`],
            },
          ]

          variants.forEach(({ messages }) =>
            messages.forEach(msg => {
              expect(parseExecutable(msg).payload).to.eql(e164PhoneNumber)
            }),
          )
        })
      })

      describe('when phone number is invalid', () => {
        it('returns a parse error', () => {
          expect(parseExecutable(`ADD ${invalidPhoneNumber}`)).to.eql({
            command: commands.ADD,
            payload: invalidPhoneNumber,
            error: messagesIn(languages.EN).parseErrors.invalidPhoneNumber(invalidPhoneNumber),
          })
        })
      })
    })

    describe('a list of phone numbers payload', () => {
      const variantsOf = phoneNumbers => [
        { language: languages.EN, message: `invite ${phoneNumbers}` },
        { language: languages.ES, message: `invitar ${phoneNumbers}` },
        { language: languages.FR, message: `inviter ${phoneNumbers}` },
        { language: languages.DE, message: `einladen ${phoneNumbers}` },
      ]

      describe('with a single valid phone number', () => {
        it('returns a command match with an array containing one e164 phone number as payload', () => {
          variantsOf(`${rawPhoneNumber}`).forEach(({ message }) =>
            expect(parseExecutable(message).payload).to.eql([e164PhoneNumber]),
          )
        })
      })

      describe('with many valid phone numbers', () => {
        it('returns a command match with an array of e164 phone numbers as payload', () => {
          variantsOf(`${rawPhoneNumber}, ${rawPhoneNumber2}`).forEach(({ message }) =>
            expect(parseExecutable(message).payload).to.eql([e164PhoneNumber, e164PhoneNumber2]),
          )
        })
      })

      describe('with one invalid phone number', () => {
        it('returns a parse error', () => {
          variantsOf(`foo`).forEach(({ message, language }) =>
            expect(parseExecutable(message).error).to.eql(
              messagesIn(language).parseErrors.invalidPhoneNumber('foo'),
            ),
          )
        })
      })

      describe('with many invalid phone numbers', () => {
        it('returns a parse error', () => {
          variantsOf(`foo, ${invalidPhoneNumber}`).forEach(({ message, language }) =>
            expect(parseExecutable(message).error).to.eql(
              messagesIn(language).parseErrors.invalidPhoneNumbers(['foo', invalidPhoneNumber]),
            ),
          )
        })
      })

      describe('with a mix of invalid and valid phone numbers', () => {
        it('returns a parse error', () => {
          variantsOf(`foo, ${rawPhoneNumber}, ${invalidPhoneNumber}, ${rawPhoneNumber2}`).forEach(
            ({ message, language }) =>
              expect(parseExecutable(message).error).to.eql(
                messagesIn(language).parseErrors.invalidPhoneNumbers(['foo', invalidPhoneNumber]),
              ),
          )
        })
      })
    })

    describe('a hotline message id payload', () => {
      describe('when it contains a valid message id', () => {
        const variants = [
          { language: languages.EN, message: 'REPLY #1312 foo' },
          { language: languages.ES, message: 'RESPONDER #1312 foo' },
          { language: languages.FR, message: 'RÉPONDRE #1312 foo' },
          { language: languages.DE, message: 'ANTWORTEN #1312 foo' },
        ]

        it('returns a command match with a HotlineReply as a payload', () => {
          variants.forEach(({ language, message }) =>
            expect(parseExecutable(message)).to.eql({
              command: commands.REPLY,
              language,
              payload: { messageId: 1312, reply: 'foo' },
            }),
          )
        })
      })

      describe('when it does not contain a valid message id', () => {
        const variants = [
          { language: languages.EN, message: 'REPLY #abc foo' },
          { language: languages.ES, message: 'RESPONDER #abc foo' },
          // { language: languages.FR, message: 'RÉPONDRE foo' },
          // { language: languages.DE, message: 'ANTWORTEN foo' },
        ]
        it('returns a parse error', () => {
          variants.forEach(({ language, message }) =>
            expect(parseExecutable(message).error).to.eql(
              messagesIn(language).parseErrors.invalidHotlineMessageId('#abc foo'),
            ),
          )
        })
      })
    })
  })
})
