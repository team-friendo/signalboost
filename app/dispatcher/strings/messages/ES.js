const { upperCase } = require('lodash')
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
const requestsClosed = `Lo sentimos, Signalboost no acepta nuevas solicitudes de canales en este momento.Vuelva a verificar más tarde.`
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
    `Lo siento, ese comando no fue reconocido.

¿Querías usar ${upperCase(command)} o TRANSMITIR?

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
    success: `¡Hola! Ahora usted está suscrito a este canal.

Responda con AYUDA para obtener más información o ADIÓS para darse de baja.`,
    alreadyMember: 'Lo sentimos, ya eres miembro de este canal.',
    belowVouchLevel: (required, actual) =>
      `Lo sentimos, este canal requiere ${required} invitacion(es) para unirse. Tiene usted ${actual}.`,
    dbError: '¡Ay! Se produjo un error al aceptar su invitación. ¡Inténtelo de nuevo!',
    subscriberLimitReached,
  },

  // ADD

  add: {
    success: newAdmin => `${newAdmin.memberPhoneNumber} agregó como ADMIN ${newAdmin.adminId}.`,
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

  // CHANNEL
  channel: {
    success: phoneNumber => `¡Se ha creado su canal Signalboost! En un momento, debería recibir un mensaje de bienvenida del número de teléfono de su canal:
${phoneNumber}.

Si tiene preguntas o tiene problemas para acceder a su canal, puede enviar un mensaje al soporte de Signalboost aquí.
`,
    requestsClosed: requestsClosed,
    error: `Lo sentimos, hubo un error al procesar tu solicitud de canal. Por favor, inténtelo de nuevo más tarde. Si su problema persiste, puede enviar un mensaje al soporte de Signalboost aquí.`,
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

número de teléfono: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
suscriptorxs: ${getSubscriberMemberships(channel).length}
límite de suscriptorxs: ${channel.subscriberLimit}
línea directa: ${onOrOff(channel.hotlineOn)}
atestiguando: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `nivel de atestiguar: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `------------------------------
INFO DEL CANAL
------------------------------

Usted es suscriptor de este canal.

número de teléfono: ${channel.phoneNumber}
línea directa: ${channel.hotlineOn ? 'activada' : 'desactivada'}
atestiguando: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `nivel de atestiguar: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `------------------------------
INFO DEL CANAL
------------------------------

Usted no es suscriptor de este canal. Envía HOLA para suscribirse.

número de teléfono: ${channel.phoneNumber}
línea directa: ${channel.hotlineOn ? 'activada' : 'desactivada'}
suscriptorxs: ${getSubscriberMemberships(channel).length}

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
    success: `¡Hola! Ahora usted está suscrito a este canal de Signalboost.

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

  // REPLY

  hotlineReply: {
    success: hotlineReply => notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
    notAdmin,
    invalidMessageId: messageId =>
      `Lo sentimos, el identificador de mensaje de línea directa @${messageId} ha caducado o nunca ha existido.`,
  },

  // REQUEST
  request: {
    success: `¡Hola! ¿Quiere crear un canal Signalboost?

Signalboost es una tecnología que le permite enviar transmisiones y recibir mensajes de línea directa sin revelar su número de teléfono a los destinatarios.

Usando este tecnología significa que confía en nosotros para que seamos buenos administradores de los números de teléfono de todos los que usan su canal:
https://signalboost.info/privacy

Ahora, si desea crear un canal, envíe CHANNEL seguido de una lista separada por comas de números de teléfono de administrador con códigos de país, por ejemplo:

CANAL +1555123412, +1555123419`,
    closed: `Lo sentimos, Signalboost no acepta nuevas solicitudes de canales en este momento. Vuelva a verificar más tarde.`,
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
      success: isOn => `Linea directa configuró en ${onOrOff(isOn)}.`,
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
    success: (mode, adminId) => {
      const vouchingStatus = adminId
        ? `ADMIN ${adminId} configuró atestiguando en ${vouchModeDisplay[mode]}.`
        : `Atestiguando configuró en ${vouchModeDisplay[mode]}.`

      const explanation = {
        ON: `Esto significa que se requiere una invitación de un miembro existente para unirse a este canal. 
Cualquiera puede enviar una invitación enviando INVITAR +1-555-123-1234.

Los administradores pueden ajustar la cantidad de invitaciones necesarias para unirse mediante el comando NIVEL DE ATESTIGUAR.`,
        OFF: `Esto significa que cualquiera puede unirse al canal enviando HOLA al número del canal.`,
        ADMIN: `Esto significa que se requiere una invitación de un *admin* para unirse a este canal.
Cualquiera puede enviar una invitación enviando INVITAR +1-555-123-1234.

Los administradores pueden ajustar la cantidad de invitaciones necesarias para unirse mediante el comando NIVEL DE ATESTIGUAR.`,
      }[mode]

      return `${vouchingStatus}

${explanation}`
    },
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

  // NONE
  none: {
    error:
      '¿Querías prefijar tu mensaje con TRANSMITIR? Envíe AYUDA para ver una lista de todos los comandos.',
  },
}

const notifications = {
  adminAdded: (adderAdminId, addedAdminId) => `ADMIN ${adderAdminId} agregó ADMIN ${addedAdminId}.`,

  adminRemoved: (removerAdminId, removedAdminId) =>
    `ADMIN ${removerAdminId} retiró ADMIN ${removedAdminId}`,

  subscriberRemoved: adminId => `ADMIN ${adminId} eliminó un suscriptor.`,

  adminLeft: adminId => `ADMIN ${adminId} dejó el canal.`,

  channelDestroyedByAdmin: (audience, adminId = '') =>
    ({
      ADMIN: `ADMIN ${adminId} ha destruido este canal. Se han eliminado todos los datos asociados.`,
      SUBSCRIBER:
        'El canal y todos los datos asociados han sido destruidos permanentemente por los administradores de este canal.',
    }[audience]),

  channelDestructionScheduled: hoursToLive =>
    `¡Hola! Este canal se destruirá en ${hoursToLive} horas debido a la falta de uso.

Para evitar que se destruya, envíe INFO dentro de las próximas ${hoursToLive} horas.

Si desea destruir el canal ahora mismo, responda DESTRUIR.

Para obtener más información, visite signalboost.info/how-to.`,

  channelDestructionFailed: phoneNumber =>
    `Error al destruir el canal para el número de teléfono:  ${phoneNumber}`,

  channelDestroyedBySystem:
    'Canal destruido por falta de uso. Para crear un nuevo canal, visite https://signalboost.info',

  channelRedeemed:
    'Este canal estaba programado para ser destruido por falta de uso. Sin embargo, dado que usó el canal recientemente, ya no se destruirá. ¡Hurra!',

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} se ha eliminado de este canal porque su número de seguridad cambió.
    
Es casi seguro porque reinstalaron Signal en un nuevo teléfono.

Sin embargo, existe una pequeña posibilidad de que un atacante haya comprometido su teléfono y esté tratando de hacerse pasar por él.

Verifique con ${adminPhoneNumber} para asegurarse de que todavía controlan su teléfono, luego vuelva a autorizarlos con:
  
AGREGAR ${adminPhoneNumber},
  
Hasta entonces, no podrán enviar mensajes ni leer mensajes de este canal.`,

  expiryUpdateNotAuthorized:
    'Lo sentimos, solo los admins pueden configurar el temporizador de mensajes desaparecidos',

  hotlineMessageSent: `Su mensaje se envió de forma anónima a los admins de este canal.
    
Enviar AYUDA para enumerar comandos válidos. Enviar HOLA para subscribirse.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Lo siento, la línea directa no está activada en este canal. Enviar AYUDA para enumerar comandos válidos.'
      : 'Lo siento, la línea directa no está activada en este canal. Envíe AYUDA para enumerar comandos válidos o HOLA para suscribirse.',

  hotlineReplyOf: ({ messageId, reply }, memberType) => {
    const prefix =
      memberType === memberTypes.ADMIN ? prefixes.hotlineReplyTo(messageId) : prefixes.hotlineReply
    return `[${prefix}]\n${reply}`
  },

  inviteReceived: `Hola! Usted ha recibido una invitación para unirse este canal de Signalboost. Por favor, responda con ACEPTAR o RECHAZAR.`,

  invitedToSupportChannel: `¡Hola! Este es el canal de soporte de Signalboost.
  
Los mantenedores de Signalboost lo utilizan para enviar anuncios ocasionales sobre nuevas funciones y responder cualquier pregunta que pueda tener.

Responda ACEPTAR para suscribirse o RECHAZAR para no suscribirse.`,

  vouchedInviteReceived: (
    invitesReceived,
    invitesNeeded,
  ) => `Hola! Usted ha recibido ${invitesReceived}/${invitesNeeded} invitaciónes necesarios para unirse a este canal de Signalboost. 
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

  channelCreationResult: (success, numAvailablePhoneNumbers, numChannels) =>
    `${success ? `Nuevo canal creó.` : `Creación de canal falló.`}
- ${numChannels} canales activos
- ${numAvailablePhoneNumbers} numeros de teléfono activos`,

  channelCreationError: err => `Error construyendo canal: ${err}`,

  restartRequesterNotAuthorized:
    '¿Estás intentando reiniciar Signalboost? ¡No estás autorizado para hacer eso!',
  restartChannelNotAuthorized:
    '¿Estás intentando reiniciar Signalboost? ¡Estás usando el canal equivocado para eso! Vuelva a intentarlo en el canal de diagnóstico.',
  restartPassNotAuthorized:
    '¿Estás intentando reiniciar Signalboost? ¡Usaste la contraseña incorrecta para eso!',
  restartSuccessNotification: adminId => `ADMIN ${adminId} reinició Signalboost.`,
  restartSuccessResponse: '¡Signalboost se reinició correctamente!',
  restartFailure: errorMessage => `No se pudo reiniciar Signalboost: ${errorMessage}`,

  safetyNumberChanged:
    'Parece que su número de seguridad acaba de cambiar. ¡Es posible que deba reenviar su último mensaje! :)',

  toRemovedAdmin: adminId =>
    `Usted ha sido eliminado como administrador de este canal por ADMIN ${adminId}. Envíe HOLA para subscribirse de nuevo.`,

  toRemovedSubscriber:
    'Acabas de ser eliminado de este canal por un administrador. Envíe HOLA para subscribirse de nuevo.',

  hotlineToggled: (isOn, adminId) =>
    `ADMIN ${adminId} configuró la linea directa en ${onOrOff(isOn)}.`,

  vouchModeChanged: commandResponses.vouchMode.success,

  vouchLevelChanged: (adminId, vouchLevel) =>
    `ADMIN ${adminId} cambió el nivel de atestiguando a ${vouchLevel}. Ahora se requiere ${vouchLevel} ${
      vouchLevel > 1 ? 'invitaciones' : 'invitación'
    } para unirse a este canal.`,

  welcome: (addingAdmin, channelPhoneNumber) =>
    `¡Bienvenidos! ${addingAdmin} acaba de convertirse en administrador de este canal de Signalboost.

1. Agregue este número de teléfono (${channelPhoneNumber}) a sus contactos.
2. Envíe AYUDA para ver qué comandos puede usar.
3. Envíe INFO para ver cuántos administradores y suscriptores hay en este canal.
4. Consulte los siguientes recursos:
- https://signalboost.info/how-to
- https://www.instagram.com/_signalboost/
- https://signalboost.info/privacy/

psNos cuesta ~$3/mes ejecutar cada canal.Dado que creamos este software para la liberación, no para el lucro, confiamos en el apoyo material de nuestra comunidad para mantener el proyecto a flote.Si puede permitírselo, considere hacer una donación aquí: https://signalboost.info/donate 💸`,
}

const prefixes = {
  broadcastMessage: `TRANSMITIR`,
  fromAdmin: 'DESDE ADMIN',
  hotlineMessage: messageId => `LÍNEA DIRECTA DESDE @${messageId}`,
  hotlineReply: `RESPUESTA PRIVADA DE ADMINS`,
  hotlineReplyTo: messageId => `RESPUESTA A @${messageId}`,
  notificationHeader: `NOTIFICACIÓN`,
  privateMessage: `PRIVADO`,
}

module.exports = {
  systemName,
  commandResponses,
  notifications,
  parseErrors,
  prefixes,
}
