const { memberTypes } = require('../../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')
const {
  signal: { maxVouchLevel },
} = require('../../../../config')

const systemName = 'Signalboost Systemadministrator*in'
const notAdmin =
  'Tut uns leid, nur Admins können diesen Befehl ausführen. Sende HILFE um eine Liste an gültigen Befehlen zu erhalten.'
const notSubscriber =
  'Dein Befehl konnte nicht bearbeitet werden, da du kein Teilnehmer dieses Kanals bist. Schicke HALLO um dich anzumelden.'
const onOrOff = isOn => (isOn ? 'an' : 'aus')

const support = `----------------------------
WIE ES FUNKTIONIERT
----------------------------

Signalboost hat Kanäle mit Admins und Teilnehmern:

-> Wenn Admins Ankündigungen senden, werden diese an alle Teilnehmern gesendet.
-> Wenn die Hotline Funktion eingeschaltet ist können alle Teilnehmer anonym Nachrichten an die Hotline schicken

Signalboost beschützt deine Privatsphäre:

-> Benutzer können nie die Telefonnummern anderer Nutzer sehen (Cops auch nicht!)
-> Signalboost liest oder speichert nie den Inhalt der Nachrichten.

Signalboost antwortet auf Befehle:

-> Schicke HILFE um sie aufzulisten.

Mehr infos gibts auf: https://signalboost.info`

const validPhoneNumberHint =
  'Telefonnummern müssen mit Ländercodes und einem vorangestellten ' + ' beginnen`'

const parseErrors = {
  invalidPhoneNumber: phoneNumber =>
    `"${phoneNumber}" ist keine gültige Telefonnummer. ${validPhoneNumberHint}`,

  invalidPhoneNumbers: phoneNumbers =>
    `"${phoneNumbers.join(', ')}" sind keine gültigen Telefonnummern. ${validPhoneNumberHint}`,

  invalidVouchLevel: vouchLevel =>
    `"${vouchLevel}" ist kein gültiges Vertrauenslevel. Nutze bitte eine Zahl zwischen 1 und ${maxVouchLevel}.`,

  invalidHotlineMessageId: payload =>
    `${payload} enthält keine gültige Hotline-Nachrichtennummer. Eine gültige Hotline-Nachrichtennummer sieht folgendermaßen aus: #123`,
}

const invalidPhoneNumber = parseErrors.invalidPhoneNumber

const commandResponses = {
  // ACCEPT

  accept: {
    success: channel => `Hi! Du bist jetzt als Teilnehmer beim Signalboost Kanal [${
      channel.name
    }] angemeldet. ${channel.description}

Antworte mit HILFE um mehr zu erfahren oder TSCHÜSS um dich abzumelden.`,
    alreadyMember: 'Ups! Du bist schon Teilnehmer an diesem Kanal.',
    belowVouchLevel: (channel, required, actual) =>
      `Sorry, für ${channel.name} brauchst du ${required} Einladung(en). Du hast ${actual}.`,
    dbError:
      'Tut uns Leid! Es gab einen Fehler beim Versuch dich zum Kanal hinzuzufügen. Bitte versuchs noch einmal!',
  },

  // ADD

  add: {
    success: num => `${num} als Admin hinzugefügt.`,
    notAdmin,
    dbError: num =>
      `Oups! Es gab einen Fehler beim Versuch ${num} als Admin hinzuzufügen. Bitte versuche es erneut!`,
    invalidPhoneNumber,
  },

  // DECLINE

  decline: {
    success: 'Einladung abgelehnt. Alle Informationen über die Einladung wurden gelöscht.',
    dbError: 'Ups! Es gab einen Fehler beim Ablehnen der Einladung. Bitte versuchs nochmal!',
  },

  destroy: {
    confirm: `Bist du sicher?

 Wenn Sie fortfahren, werden Sie diesen Kanal und alle damit verbundenen Datensätze dauerhaft zerstören.

 Um fortzufahren, antworten Sie mit:

 BESTÄTIGEN VERNICHTEN`,
    success: 'Der Kanal und alle zugehörigen Aufzeichnungen wurden unwiderrufbar gelöscht.',
    error: 'OH! Es gab einen Fehler beim Vernichten des Kanals! Bitte versuchs nochmal!',
    notAdmin,
  },

  // HELP

  help: {
    admin: `----------------------------------------------
BEFEHLE
----------------------------------------------

HILFE
-> Zeigt alle Befehle an

INFO
-> Zeigt einige statistische Infos über den Kanal, und erklärt wie Signalboost funktioniert

----------------------------------------------

UMBENENNEN neuer name
-> Benennt den Kanal in "neuer name" um

BESCHREIBUNG beschreibung des kanals
-> Fügt eine öffentliche Beschreibung des Kanals hinzu oder erneuert diese

EINLADEN +491701234567, +491707654321
-> Lädt +491701234567 und +491707654321 ein den kanal zu abonnieren

HINZUFÜGEN +491701234567
-> Fügt +491701234567 als Admin des Kanals hinzu

ENTFERNEN +491701234567
-> Entfernt +491701234567 aus dem Kanal

HOTLINE AN / AUS
-> Schaltet die Hotline Funktion an oder aus

ANTWORTEN #1312
-> Sendet eine private Antwort an [HOTLINE #1312]

PRIVAT Guten Abend, Admins
-> sendet eine private Nachricht "Guten Abend, Admins" an alle Admins des Kanals

VERTRAUEN AN / AUS
-> Bestimmt ob es einer Einladung bedarf um sich beim Kanal anzumelden

VERTRAUENS-LEVEL level
-> Verändert die Zahl der benötigten Einladungen um dem Kanal beitreten zu können

ESPAÑOL / FRANÇAIS / ENGLISH
-> Stellt die Sprache auf Spanisch, Französisch oder Englisch um

TSCHÜSS
-> Entfernt dich aus diesem Kanal

VERNICHTEN
-> Löscht den Kanal und alle zugehörigen Daten unwiderruflich`,

    subscriber: `----------------------------------------------
BEFEHLE
----------------------------------------------

HILFE
-> Zeigt alle Befehle an

INFO
-> Zeigt einige statistische Infos über den Kanal, und erklärt wie Signalboost funktioniert

----------------------------------------------

EINLADEN +491701234567, +491707654321
-> Lädt +491701234567 und +491707654321 ein den kanal zu abonnieren

ESPAÑOL / FRANÇAIS / ENGLISH
-> Stellt die Sprache auf Spanisch, Französisch oder Englisch um

HALLO
-> Macht dich zum Teilnehmer am Kanal

TSCHÜSS
-> Entfernt dich vom Kanal`,
  },

  // INFO

  info: {
    [memberTypes.ADMIN]: channel => `---------------------------
KANAL INFO:
---------------------------

Du bist ein Admin dieses Kanals.

Name: ${channel.name}

Signal-Nummer: ${channel.phoneNumber}
Admins: ${getAdminMemberships(channel).length}
Teilnehmer: ${getSubscriberMemberships(channel).length}
Hotline: ${onOrOff(channel.hotlineOn)}
Vertrauen: ${onOrOff(channel.vouchingOn)}
${channel.vouchingOn ? `Vertrauens-Level: ${channel.vouchLevel}` : ''}
${channel.description ? `Beschreibung: ${channel.description}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
KANAL INFO:
---------------------------

Du bist als Teilnehmer dieses Kanals angemeldet.

Name: ${channel.name}
Signal-Nummer: ${channel.phoneNumber}
Teilnehmer: ${getSubscriberMemberships(channel).length}
Hotline: ${onOrOff(channel.hotlineOn)}
Vertrauen: ${onOrOff(channel.vouchingOn)}
${channel.vouchingOn ? `Vertrauens-Level: ${channel.vouchLevel}` : ''}
${channel.description ? `Beschreibung: ${channel.description}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
KANAL INFO:
---------------------------

Du bist nicht bei diesem Kanal angemeldet. Schicke HALLO um dich beim Kanal als Teilnehmer anzumelden.

Name: ${channel.name}
Signal-Nummer: ${channel.phoneNumber}
Teilnehmer: ${getSubscriberMemberships(channel).length}
${channel.description ? `Beschreibung: ${channel.description}` : ''}

${support}`,
  },

  // INVITE

  invite: {
    notSubscriber,
    invalidPhoneNumber: input =>
      `Oops! Einladung wurde nicht verschickt. ${invalidPhoneNumber(input)}`,
    success: n => (n === 1 ? `Einladung versandt.` : `${n} Einladungen wurden verschickt`),
    dbError: 'Upsi! Einladung konnte nicht verschickt werden. Bitte versuche es erneut :)',
    dbErrors: (failedPhoneNumbers, allPhoneNumbers) =>
      `Upsi! Einladungen konnten nicht gesendet werden für ${failedPhoneNumbers.length} von ${
        allPhoneNumbers.length
      } Telefonnummern.
      
  Bitte versuchen Sie erneut, EINLADEN für die folgenden Telefonnummern auszugeben:
  
  ${failedPhoneNumbers.join(',')}`,
  },

  // JOIN

  join: {
    success: channel => `Hi! Du bist jetzt als Teilnehmer beim [${
      channel.name
    }] Signalboost Kanal angemeldet. ${channel.description}

Du kannst jederzeit HILFE senden um mehr zu lernen, oder TSCHÜSS um dich abzumelden.`,
    inviteRequired: `Tut uns leid, für diesen Kanal brauchst du eine Einladung. Frage Freunde nach einer Einladung!

Falls du schon eine Einladung erhalten hast, versuche ANNEHMEN zu senden`,
    dbError: `Ups! Es gab einen Fehler beim Versuch dich zum Kanal hinzuzufügen. Bitte versuchs nochmal!`,
    alreadyMember: `Ups! Du bist schon Teilnehmer an diesem Kanal.`,
  },

  // LEAVE

  leave: {
    success: `Du wurdest vom Kanal abgemeldet! Tschüssi!`,
    error: `UUps! Es gab einen Fehler beim Versuch dich zum Kanal hinzuzufügen. Bitte versuchs noch einmal!`,
    notSubscriber,
  },

  // PRIVATE

  private: {
    notAdmin,
    signalError: `Ups! Beim Versuch, den Admins dieses Kanals eine private Nachricht zu senden, ist ein Fehler aufgetreten. Bitte versuchs erneut!`,
  },

  // REMOVE

  remove: {
    success: num => `${num} wurde entfernt.`,
    notAdmin,
    targetNotMember: num => `Ups! ${num} ist kein Teilnehmer an diesem Kanal.`,
    dbError: num =>
      `Ups! Es gab einen Fehler beim Versuch ${num} zu entfernen. Bitte versuchs erneut!`,
    invalidPhoneNumber,
  },

  // RENAME

  rename: {
    success: (oldName, newName) =>
      `[${newName}]
Du hast erfolgreich den Kanal von "${oldName}" zu "${newName}" umbenannt.`,
    dbError: (oldName, newName) =>
      `[${oldName}]
Uups! Es gab einen Fehler beim Umbenennen des Kanals [${oldName}] zu [${newName}]. Versuchs nochmal!`,
    notAdmin,
  },

  // REPLY

  hotlineReply: {
    success: hotlineReply => notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
    notAdmin,
    invalidMessageId: messageId =>
      `Entschuldigung, die Hotline-Nachrichtenkennung #${messageId} ist abgelaufen oder hat nie existiert.`,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `Ab jetzt spreche ich mit dir auf Deutsch und du kannst deutsche Befehle schicken!

Sende HILFE um eine Liste der erkannten Befehle zu erhalten.`,
    dbError: 'Upsi! Fehler beim speichern der Sprachwahl. Bitte versuchs nochmal!',
  },

  // TOGGLES (HOTLINE, VOUCHING)

  toggles: {
    hotline: {
      success: isOn => `Hotline Funktion ${onOrOff(isOn)} geschaltet.`,
      notAdmin,
      dbError: isOn =>
        `Oops! Es gab einen Fehler beim Versuch die Hotline Funktion ${onOrOff(
          isOn,
        )} zu schalten. Bitte versuche es erneut!`,
    },
    vouching: {
      success: (isOn, vouchLevel) =>
        `${
          isOn
            ? `Vertrauen ist eingeschaltet.Um diesem Kanal beizutreten braucht es jetzt ${vouchLevel} ${
                vouchLevel > 1 ? 'Einladungen' : 'Einladung'
              }.

Um für jemanden dein Vertrauen auszusprechen benutze den EINLADEN Befehl. Zum Beispiel:
"EINLADEN +491701234567"

Nutze den VERTRAUENS-LEVEL Befehl um die Zahl der benötigten Einladungen zu verändern. Zum Beispiel:
"VERTRAUENS-LEVEL 3"`
            : `Vertrauen ausgeschaltet.`
        }`,
      notAdmin,
      dbError: isOn =>
        `Oh! Es gab einen Fehler beim Versuch Vertrauen ${onOrOff(
          isOn,
        )} zu schalten. Bitte versuchs nochmal!`,
    },
  },

  // TRUST

  trust: {
    success: phoneNumber => `Sicherheitsnummer für ${phoneNumber} wurde erneuert`,
    error: phoneNumber =>
      `Sicherheitsnummer von ${phoneNumber} konnte nicht erneuert werden. Versuchs nochmal oder kontaktiere einen Signalboost Maintainer!`,
    invalidPhoneNumber,
    notAdmin,
    dbError: phoneNumber =>
      `Oups! Es gab einen Fehler beim updaten der Sicherheitsnummer von ${phoneNumber}. Bitte versuchs nochmal!`,
  },

  // VOUCH_LEVEL
  vouchLevel: {
    success: level =>
      `VERTRAUENS-LEVEL auf ${level} gestellt. Jetzt benötigt es ${level} ${
        level > 1 ? 'Einladungen' : 'Einladung'
      } um diesem Kanal als Teilnehmer beizutreten.`,
    invalid: parseErrors.invalidVouchLevel,
    notAdmin,
    dbError:
      'Es gab einen Fehler beim Versuch das Vertrauens-Level umzustellen. Bitte versuchs nochmal.',
  },

  // SET_DESCRIPTION

  description: {
    success: newDescription => `Beschreibung des Kanals wurde geändert zu "${newDescription}".`,
    dbError: `Oups! Es gab einen Fehler beim Versuch die Beschreibung des Kanals zu ändern. Versuchs nochmal!`,
    notAdmin,
  },
}

const notifications = {
  adminAdded: 'Soeben wurde ein neuer Admin hinzugefügt.',

  adminRemoved: 'Soeben wurde ein Admin entfernt.',

  subscriberRemoved: 'Ein Abonnent wurde gerade entfernt.',

  adminLeft: 'Ein Admin hat den Kanal verlassen.',

  channelDestroyed: 'Der Kanal und alls zugehörigen Daten wurden unwiderruflich zerstört.',

  channelDestructionFailed: phoneNumber =>
    `Der Kanal mit der Signal-Nummer: ${phoneNumber} konnte nicht zerstört werden`,

  channelRecycled:
    'Der Kanal wurde wegen Inaktivität deaktiviert. Gehe auf https://signalboost.info um einen neuen Kanal zu erstellen.',

  channelRenamed: (oldName, newName) => `Kanal umbenannt von "${oldName}" zu "${newName}."`,

  setDescription: newDescription => `Kanal Beschreibung auf "${newDescription}." gesetzt`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} wurde vom Kanal entfernt weil ihre Sicherheitsnummer sich geändert hat.

Die warscheinlichste Ursache ist eine Neuinstallation von Signal auf einem neuen Gerät.
Trotzdem besteht eine kleine Chance das ein Angreifer sich des Telefons bemächtigt hat und nun versucht sich als diese Person auszugeben.

Setze dich mit ${adminPhoneNumber} in Verbindung um sicherzustellen, dass das Telefon unter ihrer Kontrolle ist, danach kannst du sie so neu authorisieren:

HINZUFÜGEN ${adminPhoneNumber}

Bis dahin kann ${adminPhoneNumber} weder Nachrichten von diesem Kanal lesen noch welche verschicken`,

  expiryUpdateNotAuthorized:
    'Sorry, nur Admins können den Timer für verschwindende Nachrichten umstellen.',

  hotlineMessageSent: channel =>
    `Deine Nachricht wurde an die Admins des [${channel.name}] Kanals weitergeleitet.

Schicke HILFE für eine Auflistung aller erkannten Befehle. Schiche HALLO um dich als Teilnehmer der Liste anzumelden.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Sorry, bei diesem Kanal ist die Hotline Funktion nicht aktiv. Schicke HILFE für eine Auflistung aller erkannten Befehle.'
      : 'Sorry, bei diesem Kanal ist die Hotline Funktion nicht aktiv. Schicke HILFE für eine Auflistung aller erkannten Befehle. Schiche HALLO um dich als Teilnehmer der Liste anzumelden.',

  hotlineReplyOf: ({ messageId, reply }, memberType) =>
    `[${prefixes.hotlineReplyOf(messageId, memberType)}]\n${reply}`,

  inviteReceived: channelName =>
    `Hallo! Sie haben eine Einladung zum Beitritt zum [${channelName}] Signalboost Kanal erhalten. Bitte antworte mit ANNEHMEN oder ABLEHNEN.`,

  vouchedInviteReceived: (channelName, invitesReceived, invitesNeeded) =>
    `Hallo! Du hast ${invitesReceived}/${invitesNeeded} Einladungen, dem [${channelName}] Signalboost Kanal beizutreten. ${
      invitesReceived === invitesNeeded ? 'Bitte antworte mit ANNEHMEN oder ABLEHNEN.' : ''
    }`,

  inviteAccepted: `Glückwunsch! Deine Einladung wurde angenommen, die Person ist jetzt Teilnehmer dieses Kanals.`,

  promptToUseSignal:
    'Diese Nummer akzeptiert nur Nachrichten, die mit dem Signal Private Messenger gesendet wurden. Bitte installieren Sie Signal von https://signal.org und versuchen Sie es erneut.',

  rateLimitOccurred: (channelPhoneNumber, resendInterval) =>
    `Nachrichtenrate auf: ${channelPhoneNumber} ist limitiert.
${
  resendInterval
    ? `nächster Sendeversuch in: ${resendInterval.toString().slice(0, -3)} Sekunden`
    : `Nachricht hat das Limit der Sendeversuche erreicht, es folgen keine weiteren Versuche`
}`,

  recycleChannelFailed: phoneNumber =>
    `Fehler beim Recyclen des Kanals für die Telefonnummer: ${phoneNumber}`,

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Bitte um Anmeldung erhalten von: ${senderNumber}:
${requestMsg}`,

  signupRequestResponse:
    'Danke fürs anmelden bei Signalboost! In kürze erhälst du eine Willkommens-Nachricht auf deinem neuen Kanal...',

  toRemovedAdmin:
    'Soeben wurdest du als Admin von diesem Kanal entfernt. Schicke HALLO um dich wieder anzumelden.',

  toRemovedSubscriber:
    'Du wurdest gerade von einer/m Admin von diesem Kanal entfernt. Schicke Hallo um dich erneut anzumelden.',

  toggles: commandResponses.toggles,

  vouchLevelChanged: vouchLevel =>
    `Ein Admin hat soeben das Vertrauens-Level auf ${vouchLevel} gestellt; um diesem Kanal beizutreten braucht es jetzt ${vouchLevel} ${
      vouchLevel > 1 ? 'Einladungen' : 'Einladung'
    }.`,

  welcome: (addingAdmin, channelPhoneNumber, channelName) =>
    `Du wurdest gerade als Admin in diesem Signalboost Kanal [${channelName}] hinzugefügt von ${addingAdmin}. Wilkommen!

Als Teilnehmer kann Mensch sich einfach mit einer Signal Nachricht mit dem Text HALLO an ${channelPhoneNumber}  anmelden. Um sich später wieder abzumelden kan eine Nachricht mit dem Text TSCHÜSS an die gleiche Nummer versandt werden.

Antworte HILFE für mehr Informationen.`,
}

const prefixes = {
  hotlineMessage: messageId => `HOTLINE #${messageId}`,
  hotlineReplyOf: (messageId, memberType) =>
    memberType === memberTypes.ADMIN
      ? `ANTWORT AUF HOTLINE #${messageId}`
      : `PRIVATE ANTWORT VON ADMINS`,
  broadcastMessage: `ÜBERTRAGUNG`,
  privateMessage: `PRIVAT`,
}

module.exports = {
  commandResponses,
  parseErrors,
  notifications,
  prefixes,
  systemName,
}
