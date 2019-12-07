const { upperCase } = require('lodash')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')

const systemName = 'El administrador del sistema de Signalboost'
const unauthorized = '¡Lo siento! Usted no está autorizado para hacerlo en este canal.'
const invalidNumber = phoneNumber =>
  `¡Lo siento! "${phoneNumber}" no es un número de teléfono válido. Los números de teléfono deben incluir códigos del país con el prefijo '+'.`

const support = `
----------------------------
CÓMO FUNCIONA
----------------------------

Los números de Signalboost tienen administradores y suscriptores.

-> Cuando los administradores envían mensajes, se transmiten a todos los suscriptores.
-> Si está habilitado, los suscriptores pueden enviar respuestas que solo los administradores pueden leer.
-> Los suscriptores no pueden enviarse mensajes los unos a los otros. (¡Nada de charlas enredadas ruidosas!)

Los números de Signalboost entienden los comandos.

-> Enviar AYUDA para ver la lista de comandos.
-> Las personas pueden suscribirse enviando HOLA y darse de baja con ADIÓS.
-> Enviar el nombre de idioma (por ejemplo: ESPAÑOL o ENGLISH) para cambiar de idioma.

Signalboost intenta preservar su privacidad.

-> Los usuarios de Signalboost no pueden ver los números de otros usuarios.
-> Signalboost no lee ni almacena los mensajes de nadie.

Para más información: https://signalboost.info`

const notifications = {
  adminAdded: commandIssuer => `Nuevo administrador agregado por ${commandIssuer}`,

  broadcastResponseSent: channel =>
    `Su mensaje fue enviado a los administradores de [${channel.name}].
    ¡Envíe AYUDA para ver los comandos que entiendo! :)`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} se ha eliminado de este canal porque su número de seguridad cambió.
    
Es casi seguro porque reinstalaron Signal en un nuevo teléfono.

Sin embargo, existe una pequeña posibilidad de que un atacante haya comprometido su teléfono y esté tratando de hacerse pasar por él.

Verifique con ${adminPhoneNumber} para asegurarse de que todavía controlan su teléfono, luego vuelva a autorizarlos con:
  
  AGREGAR ${adminPhoneNumber}
  
  Hasta entonces, no podrán enviar mensajes ni leer mensajes de este canal.`,

  welcome: (addingAdmin, channelPhoneNumber) => `
Acabas de convertirte en administrador de este canal Signalboost por ${addingAdmin}. ¡Bienvenido!

Las personas pueden suscribirse a este canal enviando HOLA a ${channelPhoneNumber} y cancelar la suscripción enviando ADIÓS.

Responda con AYUDA para más información.`,

  noop: '¡Lo siento! Eso no es un comando!',

  unauthorized: `
¡Lo siento! No entiendo eso.
Envíe AYUDA para ver los comandos que entiendo! :)`,

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Solicitud de registro recibida de ${senderNumber}: \n ${requestMsg}`,

  signupRequestResponse:
    '¡Gracias por registrarse en Signalboost! \nEn breve recibirá un mensaje de bienvenida en su nuevo canal...',
}

const commandResponses = {
  // ADD

  add: {
    success: num => `${num} agregó como administrador.`,
    unauthorized,
    dbError: num =>
      `¡Lo siento! Se produjo un error al agregar a ${num} como administrador. ¡Inténtelo de nuevo!`,
    invalidNumber: num =>
      `¡Lo siento! Error al agregar a "${num}". Los números de teléfono deben incluir los códigos del país con el prefijo '+'`,
  },

  // REMOVE

  remove: {
    success: num => `${num} eliminado como administrador.`,
    unauthorized,
    dbError: num =>
      `¡Lo siento! Se produjo un error al intentar eliminar a ${num}. ¡Inténtelo de nuevo!`,
    invalidNumber: num =>
      `¡Lo siento! Error al eliminar a "${num}". Los números de teléfono deben incluir los códigos del país con el prefijo '+'`,
    targetNotAdmin: num => `¡Lo siento! ${num} no es un administrador. No puedo eliminarle.`,
  },

  // HELP

  help: {
    admin: `----------------------------------------------
COMANDOS QUE ENTIENDO
----------------------------------------------

AYUDA
-> lista de comandos

INFO
-> muestra estadísticas, explica cómo funciona Signalboost

RENOMBRAR nuevo nombre
-> cambia el nombre del canal a "nuevo nombre"


AGREGAR + 1-555-555-5555
-> convierte a + 1-555-555-5555 en administrador

QUITAR + 1-555-555-5555
-> elimina a + 1-555-555-5555 como administrador

RESPUESTAS ACTIVADAS
-> permite a los suscriptores enviar mensajes a los administradores

RESPUESTAS DESACTIVADAS
-> desactiva a los suscriptores de enviar mensajes a los administradores

ADIÓS
-> le saca del canal`,

    subscriber: `----------------------------------------------
COMANDOS QUE ENTIENDO
----------------------------------------------
    
AYUDA
-> lista de comandos

INFO
-> explica cómo funciona Signalboost

HOLA
-> para subscribirse a un canal

ADIÓS
-> le da de baja`,
  },

  // INFO

  info: {
    admin: channel => `------------------------------
INFO DEL CANAL
------------------------------

nombre: ${channel.name}
número de teléfono: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
suscriptorxs: ${getSubscriberMemberships(channel).length}
respuestas: ${channel.responsesEnabled ? 'ACTIVADAS' : 'DESACTIVADAS'}
mensajes enviados: ${channel.messageCount.broadcastIn}
${support}`,

    subscriber: channel => `------------------------------
INFO DEL CANAL
------------------------------

nombre: ${channel.name}
número de teléfono: ${channel.phoneNumber}
respuestas: ${channel.responsesEnabled ? 'ACTIVADAS' : 'DESACTIVADAS'}
suscriptorxs: ${getSubscriberMemberships(channel).length}
${support}`,
    unauthorized,
  },

  // RENAME

  rename: {
    success: (oldName, newName) => `[${newName}]\nCanal renombrado de "${oldName}" a "${newName}".`,
    dbError: (oldName, newName) =>
      `[${oldName}]\n¡Lo siento! Se produjo un error al cambiar el nombre del canal [${oldName}] a [${newName}]. ¡Inténtelo de nuevo!`,
    unauthorized,
  },

  // JOIN

  join: {
    success: channel => {
      const { name } = channel
      return `
¡Bienvenido a Signalboost! Ahora usted está suscrito al canal [${name}].

Responda con AYUDA para obtener más información o ADIÓS para darse de baja.`
    },
    dbError: `¡Lo siento! Se produjo un error al agregarlo al canal. Inténtelo de nuevo!`,
    alreadyMember: `¡Lo siento! Ya eres miembro del canal.`,
  },

  // LEAVE

  leave: {
    success: `¡Usted ha sido eliminado del canal! ¡Adiós!`,
    error: `¡Lo siento! Se produjo un error al eliminarlo del canal. ¡Inténtelo de nuevo!`,
    unauthorized,
  },

  // RESPONSES_ON / RESPONSES_OFF

  toggleResponses: {
    success: setting => `Respuestas del suscriptor configurado en ${upperCase(setting)}.`,
    unauthorized,
    dbError: setting =>
      `¡Lo siento! Se produjo un error al intentar establecer respuestas a ${setting}. ¡Inténtelo de nuevo!`,
  },

  // SET_LANGUAGE

  setLanguage: {
    success:
      `¡Puede enviar comandos en Español ahora! 
      
      Envíe AYUDA para ver los comandos que comprendo.`,
    dbError: '¡Lo siento! No se pudo almacenar su preferencia de idioma. ¡Inténtelo de nuevo!',
  },

  // TRUST

  trust: {
    success: phoneNumber => `Número de seguridad actualizado para ${phoneNumber}`,
    error: phoneNumber =>
      `Error al actualizar el número de seguridad para ${phoneNumber}. ¡Inténtelo de nuevo o contacta a un mantenedor!`,
    invalidNumber,
    unauthorized,
    dbError: phoneNumber =>
      `¡Lo siento! Se produjo un error al actualizar el número de seguridad de ${phoneNumber}. ¡Inténtelo de nuevo!`,
  },
}

const prefixes = {
  broadcastResponse: `RESPUESTA DEL SUSCRIPTOR:`,
}

const EN = {
  systemName,
  commandResponses,
  notifications,
  prefixes,
}

module.exports = EN
