const { upperCase } = require('lodash')
const unauthorized = 'Whoops! No tiene autorización para hacerlo en este canal.'

const support = `
----------------------------
CÓMO FUNCIONA
----------------------------

-> Los números de Signalboost tienen administradores y suscriptores.
-> Los administradores envían anuncios que se transmiten a los suscriptores.
-> Suscríbete a los anuncios enviando "HOLA" a un número.
-> Darse de baja enviando "ADIOS" al número.
-> Enviar "AYUDA" a un número para enumerar los comandos que hacen que haga cosas.
-> Más información: https://0xacab.org/team-friendo/signalboost`

const notifications = {
  broadcastResponseSent: channel => `
Su mensaje fue enviado a los administradores de [${channel.name}].
¡Envíe AYUDA para ver los comandos que entiendo! :)
`,
  welcome: (channel, addingPublisher) => {
    const { name } = channel
    return `
¡Bienvenido a Signalboost! ${addingPublisher} te acaba de hacer un administrador del canal [${name}].

Responda con AYUDA para obtener más información o ADIÓS para irse.`
  },
  noop: 'Whoops! Eso no es un comando!',
  unauthorized: `
Whoops! No entiendo eso.
¡Envíe AYUDA para ver los comandos que entiendo! :)`,
}

const commandResponses = {
  // ADD/REMOVE PUBLISHER
  publisher: {
    add: {
      success: num => `${num} agregó como administrador.`,
      unauthorized,
      dbError: num =>
        `Whoops! Se produjo un error al agregar ${num} como administrador. ¡Inténtalo de nuevo!`,
      invalidNumber: num =>
        `Whoops! Error al agregar "${num}". Los números de teléfono deben incluir códigos de país con el prefijo '+'`,
    },
    remove: {
      success: num => `${num} eliminado como administrador.`,
      unauthorized,
      dbError: num =>
        `Whoops! Se produjo un error al intentar eliminar ${num}. ¡Inténtalo de nuevo!`,
      invalidNumber: num =>
        `¡Vaya! Error al eliminar "${num}". Los números de teléfono deben incluir códigos de país con el prefijo '+'`,
      targetNotPublisher: num => `¡Vaya! ${num} no es un administrador. No puedo eliminarla.`,
    },
  },
  // HELP
  help: {
    publisher: `
AYUDA
-> listas de comandos

INFORMACIÓN
-> muestra estadísticas, explica el refuerzo de señal

RENOMBRAR nuevo nombre
-> cambia el nombre del canal a "nuevo nombre"

RESPUESTAS ACTIVADAS / RESPUESTAS DESACTIVADAS
-> activa / desactiva las respuestas del suscriptor

AGREGAR + 1-555-555-5555
-> convierte a + 1-555-555-5555 en administrador

QUITAR + 1-555-555-5555
-> elimina + 1-555-555-5555 como administrador

ADIÓS
-> te quita del canal`,
    subscriber: `
AYUDA
-> listas de comandos

INFORMACIÓN
-> explica el refuerzo de señal

HOLA
-> te suscribe a mensajes

ADIÓS
-> te da de baja`,
  },

  // INFO
  info: {
    publisher: channel => `
---------------------------
INFO DEL CANAL:
---------------------------

nombre: ${channel.name}
número de teléfono: ${channel.phoneNumber}
suscriptorxs: ${channel.subscriptions.length}
respuestas: ${channel.responsesEnabled ? 'ACTIVADAS' : 'DESACTIVADAS'}
mensajes enviados: ${channel.messageCount.broadcastIn}
administradorxs: ${channel.publications.map(a => a.publisherPhoneNumber).join(',')}
${support}`,
    subscriber: channel => `
---------------------------
CHANNEL INFO:
---------------------------

nombre: ${channel.name}
número de teléfono: ${channel.phoneNumber}
respuestas: ${channel.responsesEnabled ? 'ACTIVADAS' : 'DESACTIVADAS'}
suscriptorxs: ${channel.subscriptions.length}
administradorxs: ${channel.publications.length}
${support}`,
    unauthorized,
  },
  // RENAME
  rename: {
    success: (oldName, newName) => `[${newName}]\nCanal renombrado de "${oldName}" a "${newName}".`,
    dbError: (oldName, newName) =>
      `[${oldName}]\nWhoops! Se produjo un error al cambiar el nombre del canal [${oldName}] a [${newName}]. ¡Inténtalo de nuevo!`,
    unauthorized,
  },
  // ADD/REMOVE SUBSCRIBER
  subscriber: {
    add: {
      success: channel => {
        const { name } = channel
        return `
¡Bienvenido a Signalboost! Ahora está suscrito al canal [${name}].

Responda con AYUDA para obtener más información o ADIÓS para darse de baja.`
      },
      dbError: `Whoops! Se produjo un error al agregarlo al canal. ¡Inténtalo de nuevo!`,
      noop: `Whoops! Ya eres miembro del canal.`,
    },
    remove: {
      success: `¡Has sido eliminado del canal! ¡Adiós!`,
      error: `Whoops! Se produjo un error al eliminarlo del canal. ¡Inténtalo de nuevo!`,
      unauthorized,
    },
  },
  // TOGGLE RESPONSES
  toggleResponses: {
    success: setting => `Respuestas del suscriptor configurado en ${upperCase(setting)}.`,
    unauthorized,
    dbError: setting =>
      `Whoops! Se produjo un error al intentar establecer respuestas a $ {setting}. ¡Inténtalo de nuevo!`,
    invalidSetting: setting =>
      `Whoops! $ {setting} no es una configuración válida. Puede configurar las respuestas para que estén ACTIVADAS o DESACTIVADAS.`,
  },
}

const prefixes = {
  helpResponse: `COMANDOS QUE ENTIENDO ...`,
  broadcastResponse: `RESPUESTA DEL SUSCRIPTOR ...`,
}

const EN = {
  commandResponses,
  notifications,
  prefixes,
}

module.exports = EN
