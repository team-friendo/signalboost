const { memberTypes } = require('../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../db/repositories/channel')
const {
  signal: { maxVouchLevel },
} = require('../../../config')

const systemName = 'El administrador del sistema de Signalboost'
const notAdmin =
  'Lo sentimos, solo los admins pueden emitir ese comando. Envíe AYUDA para obtener una lista de comandos válidos.'
const notSubscriber =
  'No se pudo procesar su comando porque no está suscrito a este canal. Envía HOLA para suscribirse.'
const subscriberLimitReached = subscriberLimit =>
  `Lo sentimos, este canal ha alcanzado su límite de ${subscriberLimit} suscriptores.`
const onOrOff = isOn => (isOn ? 'activada' : 'desactivada')

const vouchModeDisplay = {
  ON: 'activada',
  ADMIN: 'admin',
  OFF: 'desactivada',
}

const support = `----------------------------
CÓMO FUNCIONA
----------------------------

Signalboost tiene canales con administradores y suscriptores.

-> Cuando los administradores envían mensajes, se transmiten a todos los suscriptores.
-> Si está habilitado, los suscriptores pueden enviar mensajes a la línea directa.

Signalboost intenta a preservar su privacidad:

-> Los usuarios de Signalboost no pueden ver los números de otros usuarios.
-> Signalboost no lee ni almacena los mensajes de nadie.

Signalboost responde a comandos:

-> Enviar AYUDA para ver la lista de comandos.

Para más información: https://signalboost.info`

const validPhoneNumberHint = `Los números de teléfono deben incluir códigos del país con el prefijo '+'.`

const parseErrors = {
  missingCommand:
    '¿Quería prefijar su mensaje con TRANSMITIR? Envíe AYUDA para ver una lista de todos los comandos..',

  unnecessaryPayload: command =>
    `Lo siento, ese comando no fue reconocido. ¿Querías usar ${command}?

Envíe AYUDA para obtener una lista de todos los comandos válidos y cómo usarlos.`,

  invalidPhoneNumber: phoneNumber =>
    `"${phoneNumber}" no es un número de teléfono válido. ${validPhoneNumberHint}`,

  invalidPhoneNumbers: phoneNumbers =>
    `"${phoneNumbers.join(', ')}" no son números de teléfono válidos. ${validPhoneNumberHint}`,

  invalidVouchLevel: invalidVouchLevel =>
    `"${invalidVouchLevel}", no es un nivel de atestiguando válido. Use un número entre 1 y ${maxVouchLevel}, por favor.`,

  invalidHotlineMessageId: payload =>
    `¿Estabas intentando responder a un mensaje de la línea directa? Lo siento, ${payload} no es una identificación de línea directa válida. Un ID de línea directa válido se ve así: @123`,
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
    subscriberLimitReached,
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

  // BROADCAST
  broadcast: {
    notAdmin,
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

TRANSMITIR hola a todos / ! hola a todos 
-> transmite "hola a todos" a todos los suscriptores de este canal

@1312
-> envía una respuesta privada a [LÍNEA DIRECTA @1312]

INVITAR +1-555-555-5555, +1-444-444-4444
-> invita a +1-555-555-5555 y +1-444-444-4444 a suscribirse al canal

AGREGAR + 1-555-555-5555
-> agrega + 1-555-555-5555 como admin de este canal

PRIVADO hola admins / ~ hola admins
-> envía un mensaje privado "hola admins" a todos los administradores del canal

RENOMBRAR nuevo nombre
-> cambia el nombre del canal a "nuevo nombre"

DESCRIPCIÓN descripción del canal
-> agrega o actualiza la descripción pública del canal

ENGLISH / FRANÇAIS / DEUTSCH
-> cambia idiomas a Inglés, Francés o Alemán

LÍNEA DIRECTA ACTIVADA / DESACTIVADA
-> habilita o deshabilita mensajes anónimos a los admins

ATESTIGUANDO ACTIVADA / ADMIN / DESACTIVADA
-> activa / desactiva atestiguando. Cuando está ACTIVADA, se debe invitar a las personas a unirse al canal. Cuando ADMIN, solo los administradores pueden enviar esas invitaciones.

NIVEL DE ATESTIGUAR nivel
-> cambia el numero de invitaciónes requeridos para unirse a este canal 

QUITAR + 1-555-555-5555
-> quita + 1-555-555-5555 del canal

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
atestiguando: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `nivel de atestiguar: ${channel.vouchLevel}` : ''}
${channel.description ? `descripción: ${channel.description}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `------------------------------
INFO DEL CANAL
------------------------------

Usted es suscriptor de este canal.

nombre: ${channel.name}
número de teléfono: ${channel.phoneNumber}
línea directa: ${channel.hotlineOn ? 'activada' : 'desactivada'}
atestiguando: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `nivel de atestiguar: ${channel.vouchLevel}` : ''}
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
    adminOnly: 'Lo siento, solo administradores pueden emitir invitaciones para este canal.',
    dbError: '¡Ay! No se pudo emitir la invitación. Inténtelo de nuevo. :)',

    dbErrors: (failedPhoneNumbers, allPhoneNumbers) =>
      `¡Ay! No se pudo emitir las invitaciónes para ${
        failedPhoneNumbers.length
      } de ${allPhoneNumbers} números de teléfono.

Intenta emitir nuevamente INVITAR para los siguientes números:
      
${failedPhoneNumbers.join(',')}`,

    subscriberLimitReached: (numInvitees, subscriberLimit, subscriberCount) =>
      `¿Estás intentando invitar a ${numInvitees} nuevos suscriptores? Lo sentimos, este canal está limitado a ${subscriberLimit} suscriptores y ya tiene ${subscriberCount} suscriptores.`,
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
    subscriberLimitReached,
  },

  // LEAVE

  leave: {
    success: `¡Usted ha sido eliminado del canal! ¡Adiós!`,
    error: `¡Lo siento! Se produjo un error al eliminarlo del canal. ¡Inténtelo de nuevo!`,
    notSubscriber,
  },

  // PRIVATE

  private: {
    notAdmin,
    signalError: `¡Ay! Se produjo un error al intentar enviar un mensaje privado a los administradores de este canal. ¡Inténtelo de nuevo!`,
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
      `Lo sentimos, el identificador de mensaje de línea directa @${messageId} ha caducado o nunca ha existido.`,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `¡Puede enviar comandos en Español ahora! 
      
Envíe AYUDA para ver los comandos que comprendo.`,
    dbError: '¡Lo siento! No se pudo almacenar su preferencia de idioma. ¡Inténtelo de nuevo!',
  },

  // TOGGLES (HOTLINE)

  toggles: {
    hotline: {
      success: isOn => `Línea directa ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `¡Lo siento! Se produjo un error al intentar ${
          isOn ? 'activar' : 'desactivar'
        } la línea directa. ¡Inténtelo de nuevo!`,
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

  // VOUCHING
  vouchMode: {
    success: mode =>
      ({
        ON: `Se configuró atestiguando ${vouchModeDisplay.ON}.

Esto significa que se requiere una invitación de un miembro existente para unirse a este canal.
Cualquiera puede enviar una invitación enviando INVITAR +1-555-123-1234.

Los administradores pueden ajustar la cantidad de invitaciones necesarias para unirse mediante el comando NIVEL DE ATESTIGUAR.`,
        OFF: `Se configuró atestiguando ${vouchModeDisplay.OFF}.

Esto significa que cualquiera puede unirse al canal enviando HOLA al número del canal.`,
        ADMIN: `Se configuró atestiguando en ${vouchModeDisplay.ADMIN}.

Esto significa que se requiere una invitación de un *admin* para unirse a este canal.
Cualquiera puede enviar una invitación enviando INVITAR +1-555-123-1234.

Los administradores pueden ajustar la cantidad de invitaciones necesarias para unirse mediante el comando NIVEL DE ATESTIGUAR.`,
      }[mode]),
    notAdmin,
    dbError: 'Se produjo un error al actualizar atestiguando. Inténtelo de nuevo, por favor.',
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

  // NONE
  none: {
    error:
      '¿Querías prefijar tu mensaje con TRANSMITIR? Envíe AYUDA para ver una lista de todos los comandos.',
  },
}

const notifications = {
  adminAdded: 'Se acaba de agregar nuevo administrador.',

  adminRemoved: 'Se acaba de eliminar un administrador.',

  subscriberRemoved: 'Un suscriptor acaba de ser eliminado.',

  adminLeft: 'Un administrador dejó el canal.',

  channelDestroyed: 'El canal ha sido destruido permanentemente por sus admins.',

  channelEnqueuedForDestruction:
    '¡Hola! Este canal está a punto de ser destruido por falta de uso. Para evitar que se destruya, envíe "INFO" en las próximas 24 horas. Para obtener más información, visite signalboost.info/how-to.',

  channelDestructionFailed: phoneNumber =>
    `Error al destruir el canal para el número de teléfono:  ${phoneNumber}`,

  channelDestroyedDueToInactivity:
    'Canal destruido por falta de uso. Para crear un nuevo canal, visite https://signalboost.info',

  channelRedeemed:
    'Este canal estaba programado para ser destruido por falta de uso. Sin embargo, dado que usó el canal recientemente, ya no se destruirá. ¡Hurra!',

  channelRenamed: (oldName, newName) => `Canal renombrado de "${oldName}" a "${newName}."`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} se ha eliminado de este canal porque su número de seguridad cambió.
    
Es casi seguro porque reinstalaron Signal en un nuevo teléfono.

Sin embargo, existe una pequeña posibilidad de que un atacante haya comprometido su teléfono y esté tratando de hacerse pasar por él.

Verifique con ${adminPhoneNumber} para asegurarse de que todavía controlan su teléfono, luego vuelva a autorizarlos con:
  
AGREGAR ${adminPhoneNumber},
  
Hasta entonces, no podrán enviar mensajes ni leer mensajes de este canal.`,

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

  destroyChannelFailed: phoneNumber =>
    `No se pudo destruir el canal para el número de teléfono ${phoneNumber}`,

  restartRequesterNotAuthorized:
    '¿Estás intentando reiniciar Signalboost? ¡No estás autorizado para hacer eso!',
  restartChannelNotAuthorized:
    '¿Estás intentando reiniciar Signalboost? ¡Estás usando el canal equivocado para eso! Vuelva a intentarlo en el canal de diagnóstico.',
  restartPassNotAuthorized:
    '¿Estás intentando reiniciar Signalboost? ¡Usaste la contraseña incorrecta para eso!',
  restartSuccessNotification: adminId => `Signalboost fue reiniciado por ${adminId}`,
  restartSuccessResponse: '¡Signalboost se reinició correctamente!',
  restartFailure: errorMessage => `No se pudo reiniciar Signalboost: ${errorMessage}`,

  safetyNumberChanged:
    'Parece que su número de seguridad acaba de cambiar. ¡Es posible que deba reenviar su último mensaje! :)',

  setDescription: newDescription => `Descripción del canal establecida en "${newDescription}."`,

  toRemovedAdmin:
    'Usted ha sido eliminado como administrador de este canal. Envíe HOLA para subscribirse de nuevo.',

  toRemovedSubscriber:
    'Acabas de ser eliminado de este canal por un administrador. Envíe HOLA para subscribirse de nuevo.',

  toggles: commandResponses.toggles,

  vouchModeChanged: commandResponses.vouchMode.success,

  vouchLevelChanged: vouchLevel =>
    `Un administrador acaba de cambiar el nivel de atestiguando a ${vouchLevel}; ahora se requiere ${vouchLevel} ${
      vouchLevel > 1 ? 'invitaciones' : 'invitación'
    } para unirse a este canal.`,

  welcome: (addingAdmin, channelPhoneNumber, channelName) =>
    `Acabas de convertirte en administrador de este canal Signalboost [${channelName}] por ${addingAdmin}. ¡Bienvenido!

Para acceder fácilmente, agregue este número de teléfono (${channelPhoneNumber}) a sus contactos como ${channelName}. Las personas pueden suscribirse a este canal enviando HOLA a ${channelPhoneNumber} y cancelar la suscripción enviando ADIÓS.

Para ver una lista completa de comandos, envíe AYUDA o consulte nuestra guía práctica: https://signalboost.info/how-to.`,
}

const prefixes = {
  hotlineMessage: messageId => `LÍNEA DIRECTA DESDE @${messageId}`,
  hotlineReplyOf: (messageId, memberType) =>
    memberType === memberTypes.ADMIN ? `RESPUESTA A @${messageId}` : `RESPUESTA PRIVADA DE ADMINS`,
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
