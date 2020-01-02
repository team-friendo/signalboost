const { memberTypes } = require('../../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')

const systemName = 'El administrador del sistema de Signalboost'
const notAdmin =
  'Lo sentimos, solo los admins pueden emitir ese comando. Envíe AYUDA para obtener una lista de comandos válidos.'
const notSubscriber =
  'No se pudo procesar su comando porque no está suscrito a este canal. Envía HOLA para suscribirse.'
const invalidNumber = phoneNumber =>
  `¡Lo siento! "${phoneNumber}" no es un número de teléfono válido. Los números de teléfono deben incluir códigos del país con el prefijo '+'.`
const onOrOff = isOn => (isOn ? 'activada' : 'desactivada')

const support = `----------------------------
CÓMO FUNCIONA
----------------------------

Signalboost tiene canales con administradores y suscriptores.

-> Cuando los administradores envían mensajes, se transmiten a todos los suscriptores.
-> Si está habilitado, los suscriptores pueden enviar respuestas que solo los administradores pueden leer.

Signalboost intenta preservar su privacidad:

-> Los usuarios de Signalboost no pueden ver los números de otros usuarios. (¡Los policías tampoco pueden!)
-> Signalboost no lee ni almacena los mensajes de nadie.

Signalboost responde a comandos:

-> Enviar AYUDA para ver la lista de comandos.

Para más información: https://signalboost.info`

const notifications = {
  adminAdded: (commandIssuer, addedAdmin) =>
    `Nuevo administrador ${addedAdmin} agregado por ${commandIssuer}`,

  hotlineMessageSent: channel =>
    `Su mensaje se envió de forma anónima a los admins de [${
      channel.name
    }]. Incluya su número de teléfono si desea que los administradores le respondan individualmente.

Enviar AYUDA para enumerar comandos válidos.
`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Lo siento, los mensajes entrantes no están habilitados en este canal. Enviar AYUDA para enumerar comandos válidos.'
      : 'Los siento,  los mensajes entrantes no están habilitados en este canal. Envíe AYUDA para enumerar comandos válidos o HOLA para suscribirse.',

  inviteReceived: channelName => `Ha sido invitado al [${channelName}] canal de Signalboost. ¿Te gustaría suscribirte a los anuncios de este canal?
  
  Responda con ACEPTAR o RECHAZAR.`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} se ha eliminado de este canal porque su número de seguridad cambió.
    
Es casi seguro porque reinstalaron Signal en un nuevo teléfono.

Sin embargo, existe una pequeña posibilidad de que un atacante haya comprometido su teléfono y esté tratando de hacerse pasar por él.

Verifique con ${adminPhoneNumber} para asegurarse de que todavía controlan su teléfono, luego vuelva a autorizarlos con:
  
AGREGAR ${adminPhoneNumber}
  
Hasta entonces, no podrán enviar mensajes ni leer mensajes de este canal.`,

  welcome: (
    addingAdmin,
    channelPhoneNumber,
  ) => `Acabas de convertirte en administrador de este canal Signalboost por ${addingAdmin}. ¡Bienvenido!

Las personas pueden suscribirse a este canal enviando HOLA a ${channelPhoneNumber} y cancelar la suscripción enviando ADIÓS.

Responda con AYUDA para más información.`,

  noop: '¡Lo siento! Eso no es un comando!',

  unauthorized: `¡Lo siento! No entiendo eso.
  
Envíe AYUDA para ver los comandos que entiendo! :)`,

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Solicitud de registro recibida de ${senderNumber}: \n ${requestMsg}`,

  signupRequestResponse:
    '¡Gracias por registrarse en Signalboost! \nEn breve recibirá un mensaje de bienvenida en su nuevo canal...',
}

const commandResponses = {
  // ACCEPT

  accept: {
    success: channel => `¡Hola! Ahora usted está suscrito al canal [${channel.name}] de Signalboost.

Responda con AYUDA para obtener más información o ADIÓS para darse de baja.`,
    alreadyMember: 'Lo sentimos, ya eres miembro de este canal.',
    belowThreshold: (channel, required, actual) =>
      `Lo sentimos, ${
        channel.name
      } requiere ${required} invitacion(es) para unirse. Tiene usted ${actual}.`,
    dbError: '¡Ay! Se produjo un error al aceptar tu invitación. ¡Inténtalo de nuevo!',
  },

  // ADD

  add: {
    success: num => `${num} agregó como administrador.`,
    notAdmin,
    dbError: num =>
      `¡Ay! Se produjo un error al agregar a ${num} como administrador. ¡Inténtelo de nuevo!`,
    invalidNumber: num =>
      `¡Ay! Error al agregar a "${num}". Los números de teléfono deben incluir los códigos del país con el prefijo '+'`,
  },

  // DECLINE

  decline: {
    success: 'Invitación rechazada Toda la información sobre la invitación eliminada.',
    dbError: '¡Ay! Se produjo un error al rechazar la invitación. ¡Inténtalo de nuevo!',
  },

  // HELP

  help: {
    admin: `----------------------------------------------
COMANDOS
----------------------------------------------

AYUDA
-> lista de comandos

INFO
-> muestra estadísticas, explica cómo funciona Signalboost

----------------------------------------------

RENOMBRAR nuevo nombre
-> cambia el nombre del canal a "nuevo nombre"

DESCRIPCIÓN descripción del canal
-> agrega o actualiza la descripción pública del canal

INVITAR +1-555-555-5555
-> invita a +1-555-555-5555 a suscribirse al canal

AGREGAR / QUITAR + 1-555-555-5555
-> agrega or quita + 1-555-555-5555 como admin de este canal

RESPUESTAS ACTIVADAS / DESACTIVADAS
-> habilita o deshabilita mensajes entrantes a los admins

ATESTIGUANDO ACTIVADA / DESACTIVADA
-> activa o desactiva el requisito de recibir una invitación para suscribirse

ENGLISH / FRANÇAIS
-> cambia idiomas a Inglés o Francés

ADIÓS
-> le saca del canal`,

    subscriber: `----------------------------------------------
COMANDOS
----------------------------------------------
    
AYUDA
-> lista de comandos

INFO
-> muestra estadísticas, explica cómo funciona Signalboost

----------------------------------------------

INVITAR +1-555-555-5555
-> invita a +1-555-555-5555 a suscribirse al canal

ENGLISH / FRANÇAIS
-> cambia idiomas a Inglés o Francés

HOLA
-> para subscribirse a un canal

ADIÓS
-> le da de baja`,
  },

  // INFO

  info: {
    [memberTypes.ADMIN]: channel => `------------------------------
INFO DEL CANAL
------------------------------

Usted es admin de este canal.

nombre: ${channel.name}
descripción: ${channel.description}
número de teléfono: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
suscriptorxs: ${getSubscriberMemberships(channel).length}
respuestas: ${onOrOff(channel.responsesEnabled)}
atestiguando: ${onOrOff(channel.vouchingOn)}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `------------------------------
INFO DEL CANAL
------------------------------

Usted es suscriptor de este canal.

nombre: ${channel.name}
descripción: ${channel.description}
número de teléfono: ${channel.phoneNumber}
respuestas: ${channel.responsesEnabled ? 'ACTIVADAS' : 'DESACTIVADAS'}
atestiguando: ${onOrOff(channel.vouchingOn)}
suscriptorxs: ${getSubscriberMemberships(channel).length}

${support}`,

    [memberTypes.NONE]: channel => `------------------------------
INFO DEL CANAL
------------------------------

Usted no es suscriptor de este canal. Envía HOLA para suscribirse.

nombre: ${channel.name}
descripción: ${channel.description}
número de teléfono: ${channel.phoneNumber}
respuestas: ${channel.responsesEnabled ? 'ACTIVADAS' : 'DESACTIVADAS'}
suscriptorxs: ${getSubscriberMemberships(channel).length}

${support}`,
  },

  // INVITE

  invite: {
    notSubscriber,
    invalidNumber: input => `¡Ay! No se pudo emitir la invitación. ${invalidNumber(input)}`,
    success: `Invitación emitida.`,
    dbError: '¡Ay! No se pudo emitir la invitación. Inténtalo de nuevo. :)',
  },

  // REMOVE

  remove: {
    success: num => `${num} eliminado como administrador.`,
    notAdmin,
    dbError: num => `¡Ay! Se produjo un error al intentar eliminar a ${num}. ¡Inténtelo de nuevo!`,
    invalidNumber: num =>
      `¡Ay! Error al eliminar a "${num}". Los números de teléfono deben incluir los códigos del país con el prefijo '+'`,
    targetNotAdmin: num => `¡Ay! ${num} no es un administrador. No puedo eliminarle.`,
  },

  // RENAME

  rename: {
    success: (oldName, newName) => `[${newName}]\nCanal renombrado de "${oldName}" a "${newName}".`,
    dbError: (oldName, newName) =>
      `¡Lo sentimos! Se produjo un error al cambiar el nombre del canal [${oldName}] a [${newName}]. ¡Inténtelo de nuevo!`,
    notAdmin,
  },

  // JOIN

  join: {
    success: channel =>
      `¡Hola! Ahora usted está suscrito al canal [${channel.name}] de Signalboost.

Responda con AYUDA para obtener más información o ADIÓS para darse de baja.`,
    inviteRequired: `¡Lo sentimos! Se requieren invitaciones para suscribirse a este canal. ¡Pídele a un amigo que te invite!

Si ya tiene usted una invitación, intente enviar ACEPTAR`,
    dbError: `¡Ay! Se produjo un error al agregarlo al canal. ¡Inténtelo de nuevo! :)`,
    alreadyMember: `¡Ay! Ya eres miembro del canal.`,
  },

  // LEAVE

  leave: {
    success: `¡Usted ha sido eliminado del canal! ¡Adiós!`,
    error: `¡Lo siento! Se produjo un error al eliminarlo del canal. ¡Inténtelo de nuevo!`,
    notSubscriber,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `¡Puede enviar comandos en Español ahora! 
      
Envíe AYUDA para ver los comandos que comprendo.`,
    dbError: '¡Lo siento! No se pudo almacenar su preferencia de idioma. ¡Inténtelo de nuevo!',
  },

  // TOGGLES (RESPONSES, VOUCHING)

  toggles: {
    responses: {
      success: isOn => `Respuestas del suscriptor configurado en ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `¡Lo siento! Se produjo un error al intentar establecer respuestas a ${onOrOff(
          isOn,
        )}. ¡Inténtelo de nuevo!`,
    },
    vouching: {
      success: isOn => `Atestiguando configurado en ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `¡Lo siento! Se produjo un error al intentar establecer atestiguando a ${onOrOff(
          isOn,
        )}. ¡Inténtelo de nuevo!`,
    },
  },

  // TRUST

  trust: {
    success: phoneNumber => `Número de seguridad actualizado para ${phoneNumber}`,
    error: phoneNumber =>
      `Error al actualizar el número de seguridad para ${phoneNumber}. ¡Inténtelo de nuevo o contacta a un mantenedor!`,
    invalidNumber,
    notAdmin,
    dbError: phoneNumber =>
      `¡Lo siento! Se produjo un error al actualizar el número de seguridad de ${phoneNumber}. ¡Inténtelo de nuevo!`,
  },

  // SET_DESCRIPTION

  description: {
    success: newDescription => `La descripción del canal cambió a "${newDescription}".`,
    dbError: `Whoops! Se produjo un error al cambiar la descripción del canal. ¡Inténtalo de nuevo!`,
    notAdmin,
  },
}

const prefixes = {
  hotlineMessage: `RESPUESTA DEL SUSCRIPTOR`,
}

module.exports = {
  systemName,
  commandResponses,
  notifications,
  prefixes,
}
