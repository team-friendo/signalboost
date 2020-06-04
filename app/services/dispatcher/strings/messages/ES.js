const { memberTypes } = require('../../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')
const {
  signal: { maxVouchLevel },
} = require('../../../../config')

const systemName = 'El administrador del sistema de Signalboost'
const notAdmin =
  'Lo sentimos, solo los admins pueden emitir ese comando. Envíe AYUDA para obtener una lista de comandos válidos.'
const notSubscriber =
  'No se pudo procesar su comando porque no está suscrito a este canal. Envía HOLA para suscribirse.'
const onOrOff = isOn => (isOn ? 'activada' : 'desactivada')

const support = `----------------------------
CÓMO FUNCIONA
----------------------------

Signalboost tiene canales con administradores y suscriptores.

-> Cuando los administradores envían mensajes, se transmiten a todos los suscriptores.
-> Si está habilitado, los suscriptores pueden enviar mensajes a la línea directa.

Signalboost intenta a preservar su privacidad:

-> Los usuarios de Signalboost no pueden ver los números de otros usuarios. (¡Los policías tampoco no pueden!)
-> Signalboost no lee ni almacena los mensajes de nadie.

Signalboost responde a comandos:

-> Enviar AYUDA para ver la lista de comandos.

Para más información: https://signalboost.info`

const validPhoneNumberHint = `Los números de teléfono deben incluir códigos del país con el prefijo '+'.`

const parseErrors = {
  invalidPhoneNumber: phoneNumber =>
    `"${phoneNumber}" no es un número de teléfono válido. ${validPhoneNumberHint}`,

  invalidPhoneNumbers: phoneNumbers =>
    `"${phoneNumbers.join(', ')}" no son números de teléfono válidos. ${validPhoneNumberHint}`,

  invalidVouchLevel: invalidVouchLevel =>
    `"${invalidVouchLevel}", no es un nivel de atestiguando válido. Use un número entre 1 y ${maxVouchLevel}, por favor.`,

  invalidHotlineMessageId: payload =>
    `${payload} no contiene un número válido de mensaje de línea directa. Un número válido de mensaje de línea directa se ve así: #123`,
}

const invalidPhoneNumber = parseErrors.invalidPhoneNumber

const commandResponses = {
  // ACCEPT

  accept: {
    success: channel => `¡Hola! Ahora usted está suscrito al canal [${
      channel.name
    }] de Signalboost. ${channel.description}

Responda con AYUDA para obtener más información o ADIÓS para darse de baja.`,
    alreadyMember: 'Lo sentimos, ya eres miembro de este canal.',
    belowVouchLevel: (channel, required, actual) =>
      `Lo sentimos, ${
        channel.name
      } requiere ${required} invitacion(es) para unirse. Tiene usted ${actual}.`,
    dbError: '¡Ay! Se produjo un error al aceptar su invitación. ¡Inténtelo de nuevo!',
  },

  // ADD

  add: {
    success: num => `${num} agregó como administrador.`,
    notAdmin,
    dbError: num =>
      `¡Ay! Se produjo un error al agregar a ${num} como administrador. ¡Inténtelo de nuevo!`,
    invalidPhoneNumber: num =>
      `¡Ay! Error al agregar a "${num}". Los números de teléfono deben incluir los códigos del país con el prefijo '+'`,
  },

  // DECLINE

  decline: {
    success: 'Invitación rechazada. Toda la información sobre la invitación fue eliminada.',
    dbError: '¡Ay! Se produjo un error al rechazar la invitación. ¡Inténtelo de nuevo!',
  },

  // DESTROY

  destroy: {
    confirm: `¿Está seguro?

Si continúa, destruirá permanentemente este canal y todos los registros asociados con él.

Para continuar, responda con:

CONFIRMAR DESTRUIR`,

    success: 'El canal ha sido destruido permanentamente por sus admins.',
    error: '¡Ay! Se produjo un error al destruir el canal. ¡Inténtelo de nuevo!',
    notAdmin,
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

INVITAR +1-555-555-5555, +1-444-444-4444
-> invita a +1-555-555-5555 y +1-444-444-4444 a suscribirse al canal

AGREGAR + 1-555-555-5555
-> agrega + 1-555-555-5555 como admin de este canal

QUITAR + 1-555-555-5555
-> quita + 1-555-555-5555 del canal

LÍNEA DIRECTA ACTIVADA / DESACTIVADA
-> habilita o deshabilita mensajes anónimos a los admins

RESPONDER #1312
-> envía una respuesta privada a [LÍNEA DIRECTA #1312]

PRIVADO buenas noches, admins
-> envía un mensaje privado "buenas noches, admins" a todos los administradores del canal

ATESTIGUANDO ACTIVADA / DESACTIVADA
-> activa o desactiva el requisito de recibir una invitación para suscribirse

NIVEL DE ATESTIGUAR nivel
-> cambia el numero de invitaciónes requeridos para unirse a este canal 

ENGLISH / FRANÇAIS / DEUTSCH
-> cambia idiomas a Inglés, Francés o Alemán

ADIÓS
-> le saca del canal

DESTRUIR
-> destruye permanentemente este canal y todos los registros asociados`,

    subscriber: `----------------------------------------------
COMANDOS
----------------------------------------------
    
AYUDA
-> lista de comandos

INFO
-> muestra estadísticas, explica cómo funciona Signalboost

----------------------------------------------

INVITAR +1-555-555-5555, +1-444-444-4444
-> invita a +1-555-555-5555 y +1-444-444-4444 a suscribirse al canal

ENGLISH / FRANÇAIS / DEUTSCH
-> cambia idiomas a Inglés, Francés o Alemán

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
número de teléfono: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
suscriptorxs: ${getSubscriberMemberships(channel).length}
línea directa: ${onOrOff(channel.hotlineOn)}
atestiguando: ${onOrOff(channel.vouchingOn)}
${channel.vouchingOn ? `nivel de atestiguar: ${channel.vouchLevel}` : ''}
${channel.description ? `descripción: ${channel.description}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `------------------------------
INFO DEL CANAL
------------------------------

Usted es suscriptor de este canal.

nombre: ${channel.name}
número de teléfono: ${channel.phoneNumber}
suscriptorxs: ${getSubscriberMemberships(channel).length}
línea directa: ${channel.hotlineOn ? 'activada' : 'desactivada'}
atestiguando: ${onOrOff(channel.vouchingOn)}
${channel.vouchingOn ? `nivel de atestiguar: ${channel.vouchLevel}` : ''}
${channel.description ? `descripción: ${channel.description}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `------------------------------
INFO DEL CANAL
------------------------------

Usted no es suscriptor de este canal. Envía HOLA para suscribirse.

nombre: ${channel.name}
número de teléfono: ${channel.phoneNumber}
línea directa: ${channel.hotlineOn ? 'activada' : 'desactivada'}
suscriptorxs: ${getSubscriberMemberships(channel).length}
${channel.description ? `descripción: ${channel.description}` : ''}

${support}`,
  },

  // INVITE

  invite: {
    notSubscriber,
    invalidPhoneNumber: input =>
      `¡Ay! No se pudo emitir la invitación. ${invalidPhoneNumber(input)}`,
    success: n => (n === 1 ? `Se emitió la invitación` : `Se emitieron ${n} invitaciones`),
    dbError: '¡Ay! No se pudo emitir la invitación. Inténtelo de nuevo. :)',
    dbErrors: (failedPhoneNumbers, allPhoneNumbers) =>
      `¡Ay! No se pudo emitir las invitaciónes para ${
        failedPhoneNumbers.length
      } de ${allPhoneNumbers} números de teléfono.

Intenta emitir nuevamente INVITAR para los siguientes números:
      
${failedPhoneNumbers.join(',')}`,
  },

  // PRIVATE

  private: {
    notAdmin,
    signalError: `¡Ay! Se produjo un error al intentar enviar un mensaje privado a los administradores de este canal. ¡Inténtelo de nuevo!`
  },

  // REMOVE

  remove: {
    success: num => `${num} fue eliminado.`,
    notAdmin,
    targetNotMember: num => `¡Ay! ${num} no es miembro de este canal.`,
    dbError: num => `¡Ay! Se produjo un error al intentar eliminar a ${num}. ¡Inténtelo de nuevo!`,
    invalidPhoneNumber: num =>
      `¡Ay! Error al eliminar a "${num}". Los números de teléfono deben incluir los códigos del país con el prefijo '+'`,
  },

  // RENAME

  rename: {
    success: (oldName, newName) => `[${newName}]
    Canal renombrado de "${oldName}" a "${newName}".`,
    dbError: (oldName, newName) =>
      `¡Lo sentimos! Se produjo un error al cambiar el nombre del canal [${oldName}] a [${newName}]. ¡Inténtelo de nuevo!`,
    notAdmin,
  },

  // REPLY

  hotlineReply: {
    success: hotlineReply => notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
    notAdmin,
    invalidMessageId: messageId =>
      `Lo sentimos, el identificador de mensaje de línea directa #${messageId} ha caducado o nunca ha existido.`,
  },

  // JOIN

  join: {
    success: channel =>
      `¡Hola! Ahora usted está suscrito al canal [${channel.name}] de Signalboost. ${
        channel.description
      }

Responda con AYUDA para obtener más información o ADIÓS para darse de baja.`,
    inviteRequired: `¡Lo sentimos! Se requieren invitaciones para suscribirse a este canal. ¡Pídele a un amigo que te invite!

Si ya tiene usted una invitación, intente enviar ACEPTAR`,
    dbError: `¡Ay! Se produjo un error al agregarlo al canal. ¡Inténtelo de nuevo! :)`,
    alreadyMember: `¡Ay! Ya usted es miembro del canal.`,
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

  // TOGGLES (HOTLINE, VOUCHING)

  toggles: {
    hotline: {
      success: isOn => `Línea directa ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `¡Lo siento! Se produjo un error al intentar ${
          isOn ? 'activar' : 'desactivar'
        } la línea directa. ¡Inténtelo de nuevo!`,
    },
    vouching: {
      success: (isOn, vouchLevel) =>
        `${
          isOn
            ? `Atestiguando activada. Ahore se require ${vouchLevel} ${
                vouchLevel > 1 ? 'invitaciones' : 'invitación'
              } para unirse a este canal.

Para atestiguar para alguien, use el comando INVITAR. Por ejemplo:
"INVITAR +12345551234"

Para cambiar el nivel de atestiguar, use el comando NIVEL DE ATESTIGUAR. Por ejemplo:
"NIVEL DE ATESTIGUAR 3"`
            : `Atestiguando desactivada.`
        }`,
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
    invalidPhoneNumber,
    notAdmin,
    dbError: phoneNumber =>
      `¡Lo siento! Se produjo un error al actualizar el número de seguridad de ${phoneNumber}. ¡Inténtelo de nuevo!`,
  },

  // VOUCH_LEVEL

  vouchLevel: {
    success: level =>
      `Nivel de atestiguando cambiado a ${level}. Ahora se requieren ${level} ${
        level > 1 ? 'invitaciones' : 'invitación'
      } para nuevos suscriptores unirse a este canal.`,
    invalid: parseErrors.invalidVouchLevel,
    notAdmin,
    dbError:
      'Se produjo un error al actualizar el nivel de atestiguando. Inténtelo de nuevo, por favor.',
  },

  // SET_DESCRIPTION

  description: {
    success: newDescription => `La descripción del canal cambió a "${newDescription}".`,
    dbError: `Whoops! Se produjo un error al cambiar la descripción del canal. ¡Inténtelo de nuevo!`,
    notAdmin,
  },
}

const notifications = {
  adminAdded: 'Se acaba de agregar nuevo administrador.',

  adminRemoved: 'Se acaba de eliminar un administrador.',

  subscriberRemoved: 'Un suscriptor acaba de ser eliminado.',

  adminLeft: 'Un administrador dejó el canal.',

  channelDestroyed: 'El canal ha sido destruido permanentemente por sus admins.',

  channelDestructionFailed: phoneNumber =>
    `Error al destruir el canal para el número de teléfono:  ${phoneNumber}`,

  channelRecycled:
    'Canal desactivado por falta de uso. Para crear un nuevo canal, visite https://signalboost.info',

  channelRenamed: (oldName, newName) => `Canal renombrado de "${oldName}" a "${newName}."`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} se ha eliminado de este canal porque su número de seguridad cambió.
    
Es casi seguro porque reinstalaron Signal en un nuevo teléfono.

Sin embargo, existe una pequeña posibilidad de que un atacante haya comprometido su teléfono y esté tratando de hacerse pasar por él.

Verifique con ${adminPhoneNumber} para asegurarse de que todavía controlan su teléfono, luego vuelva a autorizarlos con:
  
AGREGAR ${adminPhoneNumber},
  
Hasta entonces, no podrán enviar mensajes ni leer mensajes de este canal.`,
  setDescription: newDescription => `Descripción del canal establecida en "${newDescription}."`,

  expiryUpdateNotAuthorized:
    'Lo sentimos, solo los admins pueden configurar el temporizador de mensajes desaparecidos',

  hotlineMessageSent: channel =>
    `Su mensaje se envió de forma anónima a los admins de [${channel.name}].
    
Enviar AYUDA para enumerar comandos válidos. Enviar HOLA para subscribirse.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Lo siento, la línea directa no está activada en este canal. Enviar AYUDA para enumerar comandos válidos.'
      : 'Lo siento, la línea directa no está activada en este canal. Envíe AYUDA para enumerar comandos válidos o HOLA para suscribirse.',

  hotlineReplyOf: ({ messageId, reply }, memberType) =>
    `[${prefixes.hotlineReplyOf(messageId, memberType)}]\n${reply}`,

  inviteReceived: channelName =>
    `Hola! Usted ha recibido una invitación para unirse al canal Signalboost de [${channelName}]. Por favor, responda con ACEPTAR o RECHAZAR.`,

  vouchedInviteReceived: (
    channelName,
    invitesReceived,
    invitesNeeded,
  ) => `Hola! Usted ha recibido ${invitesReceived}/${invitesNeeded} invitaciónes necesarios para unirse al canal Signalboost de [${channelName}]. 
      ${invitesReceived === invitesNeeded ? `Por favor, responda con ACEPTAR o RECHAZAR.` : ''}
    `,

  inviteAccepted: `¡Felicidades! Alguien ha aceptado su invitación y ahora está suscrito a este canal.`,

  promptToUseSignal:
    'Este número solo acepta mensajes enviados con Signal Private Messenger. Instale Signal desde https://signal.org y intente nuevamente.',

  noop: '¡Lo siento! Eso no es un comando!',

  unauthorized: `¡Lo siento! No entiendo eso.
  
Envíe AYUDA para ver los comandos que entiendo! :)`,

  rateLimitOccurred: (channelPhoneNumber, resendInterval) =>
    `Error de límite de velocidad en canal: ${channelPhoneNumber}.
${
  resendInterval
    ? `se intentará reenviar el mensaje en: ${resendInterval.toString().slice(0, -3)}s`
    : `el mensaje ha excedido el umbral de reenvío y no se reenviará`
}`,

  recycleChannelFailed: phoneNumber =>
    `Error al reciclar el canal para el número de teléfono: ${phoneNumber}`,

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Solicitud de registro recibida de ${senderNumber}:
${requestMsg}`,

  signupRequestResponse: `¡Gracias por registrarse en Signalboost! 
En breve recibirá un mensaje de bienvenida en su nuevo canal...`,

  toRemovedAdmin:
    'Usted ha sido eliminado como administrador de este canal. Envíe HOLA para subscribirse de nuevo.',

  toRemovedSubscriber:
    'Acabas de ser eliminado de este canal por un administrador. Envíe HOLA para subscribirse de nuevo.',

  toggles: commandResponses.toggles,

  vouchLevelChanged: vouchLevel =>
    `Un administrador acaba de cambiar el nivel de atestiguando a ${vouchLevel}; ahora se requiere ${vouchLevel} ${
      vouchLevel > 1 ? 'invitaciones' : 'invitación'
    } para unirse a este canal.`,

  welcome: (addingAdmin, channelPhoneNumber, channelName) =>
    `Acabas de convertirte en administrador de este canal Signalboost [${channelName}] por ${addingAdmin}. ¡Bienvenido!

Las personas pueden suscribirse a este canal enviando HOLA a ${channelPhoneNumber} y cancelar la suscripción enviando ADIÓS.

Responda con AYUDA para más información.`,
}

const prefixes = {
  hotlineMessage: messageId => `LÍNEA DIRECTA #${messageId}`,
  hotlineReplyOf: (messageId, memberType) =>
    memberType === memberTypes.ADMIN
      ? `RESPONDER A LA LÍNEA DIRECTA #${messageId}`
      : `RESPUESTA PRIVADA DE ADMINS`,
  broadcastMessage: `TRANSMITIR`,
  privateMessage: `PRIVADO`,
}

module.exports = {
  systemName,
  commandResponses,
  notifications,
  parseErrors,
  prefixes,
}
