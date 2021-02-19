const { upperCase } = require('lodash')
const { memberTypes } = require('../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../db/repositories/channel')
const {
  signal: { maxVouchLevel },
} = require('../../../config')

const systemName = 'Signalboost Systemadministrator'
const notAdmin =
  'Tut uns leid, nur Admins können diesen Befehl ausführen. Sende HILFE um eine Liste an gültigen Befehlen zu erhalten.'
const notSubscriber =
  'Dein Befehl konnte nicht bearbeitet werden, da du kein Teilnehmer dieses Kanals bist. Schicke HALLO um dich anzumelden.'
const subscriberLimitReached = subscriberLimit =>
  `Entschuldigung, dieser Kanal hat sein Limit von ${subscriberLimit} Abonnenten erreicht.`
const requestsClosed = `Sorry, Signalboost akzeptiert derzeit keine neuen Kanalanfragen! Bitte versuchen Sie es später noch einmal.`
const onOrOff = isOn => (isOn ? 'an' : 'aus')

const vouchModeDisplay = {
  ON: 'an',
  ADMIN: 'admin',
  OFF: 'aus',
}

const support = `----------------------------
WIE ES FUNKTIONIERT
----------------------------

Signalboost hat Kanäle mit Admins und Teilnehmern:

-> Wenn Admins Ankündigungen senden, werden diese an alle Teilnehmern gesendet.
-> Wenn die Hotline Funktion eingeschaltet ist können alle Teilnehmer anonym Nachrichten an die Hotline schicken

Signalboost beschützt deine Privatsphäre:

-> Benutzer können nie die Telefonnummern anderer Nutzer sehen.
-> Signalboost liest oder speichert nie den Inhalt der Nachrichten.

Signalboost antwortet auf Befehle:

-> Schicke HILFE um sie aufzulisten.

Mehr infos gibts auf: https://signalboost.info`

const validPhoneNumberHint =
  'Telefonnummern müssen mit Ländercodes und einem vorangestellten ' + ' beginnen`'

const parseErrors = {
  missingCommand:
    'Did you mean to prefix your message with SENDEN? Send HILFE to see a list of all commands.',

  unnecessaryPayload: command =>
    `Sorry, dieser Befehl wurde nicht erkannt.

Wollten Sie ${upperCase(command)} oder SENDEN verwenden?

Senden Sie HILFE, um eine Liste aller gültigen Befehle und deren Verwendung zu erhalten.`,

  invalidPhoneNumber: phoneNumber =>
    `"${phoneNumber}" ist keine gültige Telefonnummer. ${validPhoneNumberHint}`,

  invalidPhoneNumbers: phoneNumbers =>
    `"${phoneNumbers.join(', ')}" sind keine gültigen Telefonnummern. ${validPhoneNumberHint}`,

  invalidVouchLevel: vouchLevel =>
    `"${vouchLevel}" ist kein gültiges Vertrauenslevel. Nutze bitte eine Zahl zwischen 1 und ${maxVouchLevel}.`,

  invalidHotlineMessageId: payload =>
    `Haben Sie versucht, auf eine Hotline-Nachricht zu antworten? Entschuldigung, ${payload} ist keine gültige Hotline-ID. Eine gültige Hotline-ID sieht wie folgt aus: @123`,
}

const invalidPhoneNumber = parseErrors.invalidPhoneNumber

const commandResponses = {
  // ACCEPT

  accept: {
    success: `Hallo! Sie haben jetzt diesen Signalboost-Kanal abonniert.

Antworte mit HILFE um mehr zu erfahren oder TSCHÜSS um dich abzumelden.`,
    alreadyMember: 'Ups! Du bist schon Teilnehmer an diesem Kanal.',
    belowVouchLevel: (required, actual) =>
      `Entschuldigung, dieser Kanal erfordert ${required} Einladung(en). Du hast ${actual}.`,
    dbError:
      'Tut uns Leid! Es gab einen Fehler beim Versuch dich zum Kanal hinzuzufügen. Bitte versuchs noch einmal!',
    subscriberLimitReached,
  },

  // ADD

  add: {
    success: newAdmin =>
      `${newAdmin.memberPhoneNumber} wurde als ADMIN ${newAdmin.adminId} hinzugefügt.`,
    notAdmin,
    dbError: num =>
      `Oups! Es gab einen Fehler beim Versuch ${num} als Admin hinzuzufügen. Bitte versuche es erneut!`,
    invalidPhoneNumber,
  },

  // BROADCAST
  broadcast: {
    notAdmin,
  },

  // CHANNEL
  channel: {
    success: phoneNumber => `Ihr Signalboost-Kanal wurde erstellt! In Kürze sollten Sie eine Begrüßungsnachricht von Ihrer Kanal-Telefonnummer erhalten:
${phoneNumber}.

Wenn Sie Fragen haben oder Probleme beim Zugriff auf Ihren Kanal haben, können Sie hier den Signalboost-Support benachrichtigen.
`,
    requestsClosed: requestsClosed,
    error: `Entschuldigung, es ist ein Fehler bei der Verarbeitung Ihrer Kanalanfrage aufgetreten! Bitte versuchen Sie es später noch einmal. Wenn Ihr Problem weiterhin besteht, können Sie hier den Signalboost-Support benachrichtigen.`,
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

SENDEN hallo an alle / ! hallo an alle
-> sendet "hallo an alle" an alle Abonnenten dieses Kanals

@1312
-> Sendet eine private Antwort an [HOTLINE @1312]

EINLADEN +491701234567, +491707654321
-> Lädt +491701234567 und +491707654321 ein den kanal zu abonnieren

HINZUFÜGEN +491701234567
-> Fügt +491701234567 als Admin des Kanals hinzu

PRIVAT Hallo Admins / ~ Hallo admins
-> Dendet eine private Nachricht "Hallo Admins" an alle Admins des Kanals

ESPAÑOL / FRANÇAIS / ENGLISH
-> Stellt die Sprache auf Spanisch, Französisch oder Englisch um

HOTLINE AN / AUS
-> Schaltet die Hotline Funktion an oder aus

VERTRAUEN AN / AUS / ADMIN
-> Schaltet die Gutscheine EIN / AUS. Wenn EIN, müssen Personen eingeladen werden, dem Kanal beizutreten. Bei ADMIN können nur Administratoren diese Einladungen senden.

VERTRAUENS-LEVEL level
-> Verändert die Zahl der benötigten Einladungen um dem Kanal beitreten zu können

TSCHÜSS
-> Entfernt dich aus diesem Kanal

ENTFERNEN +491701234567
-> Entfernt +491701234567 aus dem Kanal

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


Signal-Nummer: ${channel.phoneNumber}
Admins: ${getAdminMemberships(channel).length}
Teilnehmer: ${getSubscriberMemberships(channel).length}
Teilnehmerlimit: ${channel.subscriberLimit}
Hotline: ${onOrOff(channel.hotlineOn)}
Vertrauen: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `Vertrauens-Level: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
KANAL INFO:
---------------------------

Du bist als Teilnehmer dieses Kanals angemeldet.

Signal-Nummer: ${channel.phoneNumber}
Hotline: ${onOrOff(channel.hotlineOn)}
Vertrauen: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `Vertrauens-Level: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
KANAL INFO:
---------------------------

Du bist nicht bei diesem Kanal angemeldet. Schicke HALLO um dich beim Kanal als Teilnehmer anzumelden.

Signal-Nummer: ${channel.phoneNumber}
Teilnehmer: ${getSubscriberMemberships(channel).length}

${support}`,
  },

  // INVITE

  invite: {
    notSubscriber,
    invalidPhoneNumber: input =>
      `Oops! Einladung wurde nicht verschickt. ${invalidPhoneNumber(input)}`,
    success: n => (n === 1 ? `Einladung versandt.` : `${n} Einladungen wurden verschickt`),
    adminOnly: 'Leider können nur Administratoren Personen zu diesem Kanal einladen.',
    dbError: 'Upsi! Einladung konnte nicht verschickt werden. Bitte versuche es erneut :)',

    dbErrors: (failedPhoneNumbers, allPhoneNumbers) =>
      `Upsi! Einladungen konnten nicht gesendet werden für ${failedPhoneNumbers.length} von ${
        allPhoneNumbers.length
      } Telefonnummern.
      
  Bitte versuchen Sie erneut, EINLADEN für die folgenden Telefonnummern auszugeben:
  
  ${failedPhoneNumbers.join(',')}`,

    subscriberLimitReached: (numInvitees, subscriberLimit, subscriberCount) =>
      `Versuchen Sie, ${numInvitees} neue Abonnenten einzuladen? Entschuldigung, dieser Kanal ist auf ${subscriberLimit} Abonnenten begrenzt und hat bereits ${subscriberCount} Abonnenten.`,
  },

  // JOIN

  join: {
    success: `Hallo! Sie haben jetzt diesen Signalboost-Kanal abonniert.

Du kannst jederzeit HILFE senden um mehr zu lernen, oder TSCHÜSS um dich abzumelden.`,
    inviteRequired: `Tut uns leid, für diesen Kanal brauchst du eine Einladung. Frage Freunde nach einer Einladung!

Falls du schon eine Einladung erhalten hast, versuche ANNEHMEN zu senden`,
    dbError: `Ups! Es gab einen Fehler beim Versuch dich zum Kanal hinzuzufügen. Bitte versuchs nochmal!`,
    alreadyMember: `Ups! Du bist schon Teilnehmer an diesem Kanal.`,
    subscriberLimitReached,
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

  // REPLY

  hotlineReply: {
    success: hotlineReply => notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
    notAdmin,
    invalidMessageId: messageId =>
      `Entschuldigung, die Hotline-Nachrichtenkennung @${messageId} ist abgelaufen oder hat nie existiert.`,
  },

  // REQUEST

  request: {
    success: `Hallo! Möchten Sie einen Signalboost-Kanal erstellen?

Signalboost ist eine Technologie, mit der Sie Sendungen senden und Hotline-Nachrichten empfangen können, ohne Ihre Telefonnummer den Empfängern preiszugeben.

Wenn Sie dieses Tool verwenden, vertrauen Sie darauf, dass wir die Telefonnummern aller Benutzer Ihres Kanals gut verwalten:
https://signalboost.info/privacy

Wenn Sie jetzt einen Kanal erstellen möchten, senden Sie CHANNEL, gefolgt von einer durch Kommas getrennten Liste von Admin-Telefonnummern mit Ländercodes, zum Beispiel:

CHANNEL +1555123412, +1555123419`,
    closed: `Entschuldigung, Signalboost akzeptiert derzeit keine neuen Kanalanfragen! Bitte versuchen Sie es später noch einmal.`,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `Ab jetzt spreche ich mit dir auf Deutsch und du kannst deutsche Befehle schicken!

Sende HILFE um eine Liste der erkannten Befehle zu erhalten.`,
    dbError: 'Upsi! Fehler beim speichern der Sprachwahl. Bitte versuchs nochmal!',
  },

  // TOGGLES (HOTLINE)

  toggles: {
    hotline: {
      success: isOn => `Hotline  ${onOrOff(isOn)}geschaltet.`,
      notAdmin,
      dbError: isOn =>
        `Oops! Es gab einen Fehler beim Versuch die Hotline Funktion ${onOrOff(
          isOn,
        )} zu schalten. Bitte versuche es erneut!`,
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

  // VOUCHING
  vouchMode: {
    success: (mode, adminId) => {
      const vouchingStatus = adminId
        ? `ADMIN ${adminId} schaltete der gutschein ${vouchModeDisplay[mode]}.`
        : `Gutschein ist jetzt ${vouchModeDisplay[mode]}.`

      const explanation = {
        ON: `Dies bedeutet, dass eine Einladung eines vorhandenen Mitglieds erforderlich ist, um diesem Kanal beizutreten.
Jeder kann eine Einladung senden, indem er EINLADEN + 1-555-123-1234 sendet.

Administratoren können die Anzahl der zum Beitritt erforderlichen Einladungen mithilfe des Befehls VERTRAUENS-LEVEL anpassen.`,
        OFF: `Dies bedeutet, dass jeder dem Kanal beitreten kann, indem er HALLO an die Kanalnummer sendet.`,
        ADMIN: `
Dies bedeutet, dass eine Einladung eines *Administrators* erforderlich ist, um diesem Kanal beizutreten.
Jeder kann eine Einladung senden, indem er EINLADEN + 1-555-123-1234 sendet.

Administratoren können die Anzahl der zum Beitritt erforderlichen Einladungen mithilfe des Befehls VERTRAUENS-LEVEL anpassen.`,
      }[mode]

      return `${vouchingStatus}

${explanation}`
    },
    notAdmin,
    dbError:
      'Beim Aktualisieren der Gutscheine für Ihren Kanal ist ein Fehler aufgetreten. Bitte versuche es erneut .',
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

  // NONE
  none: {
    error:
      'Wollten Sie Ihrer Nachricht SENDEN voranstellen? Senden Sie HILFE, um eine Liste aller Befehle anzuzeigen.',
  },
}

const notifications = {
  adminAdded: (adderAdminId, addedAdminId) =>
    `ADMIN ${adderAdminId} hat ADMIN ${addedAdminId} hinzugefügt.`,

  adminRemoved: (removerAdminId, removedAdminId) =>
    `ADMIN ${removerAdminId} entfernte ADMIN ${removedAdminId}`,

  subscriberRemoved: adminId => `ADMIN ${adminId} einen Abonnenten entfernt.`,

  adminLeft: adminId => `ADMIN ${adminId} hat den Kanal verlassen.`,

  channelDestroyedByAdmin: (adminId, audience) =>
    ({
      ADMIN: `ADMIN ${adminId} hat diesen Kanal zerstört. Alle zugehörigen Daten wurden gelöscht.`,
      SUBSCRIBER:
        'Der Kanal und alle zugehörigen Daten wurden von den Administratoren dieses Kanals dauerhaft zerstört.',
    }[audience]),

  channelDestructionScheduled: hoursToLive =>
    `Hallo! Dieser Kanal wird in ${hoursToLive} Stunden aufgrund mangelnder Nutzung zerstört.

Um zu verhindern, dass es zerstört wird, senden Sie INFO innerhalb der nächsten ${hoursToLive} Stunden.

Wenn Sie den Kanal jetzt zerstören möchten, antworten Sie mit VERNICHTEN.

Weitere Informationen finden Sie unter signalboost.info/how-to.`,

  channelDestructionFailed: phoneNumber =>
    `Der Kanal mit der Signal-Nummer: ${phoneNumber} konnte nicht zerstört werden`,

  channelDestroyedBySystem:
    'Kanal wegen mangelnder Nutzung zerstört. Um einen neuen Kanal zu erstellen, besuchen Sie https://signalboost.info',

  channelRedeemed:
    'Dieser Kanal sollte wegen mangelnder Nutzung zerstört werden. Da Sie den Kanal kürzlich verwendet haben, wird er jedoch nicht mehr zerstört. Yay!',

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} wurde vom Kanal entfernt weil ihre Sicherheitsnummer sich geändert hat.

Die warscheinlichste Ursache ist eine Neuinstallation von Signal auf einem neuen Gerät.
Trotzdem besteht eine kleine Chance das ein Angreifer sich des Telefons bemächtigt hat und nun versucht sich als diese Person auszugeben.

Setze dich mit ${adminPhoneNumber} in Verbindung um sicherzustellen, dass das Telefon unter ihrer Kontrolle ist, danach kannst du sie so neu authorisieren:

HINZUFÜGEN ${adminPhoneNumber}

Bis dahin kann ${adminPhoneNumber} weder Nachrichten von diesem Kanal lesen noch welche verschicken`,

  expiryUpdateNotAuthorized:
    'Sorry, nur Admins können den Timer für verschwindende Nachrichten umstellen.',

  hotlineMessageSent: `Ihre Nachricht wurde an die Administratoren dieses Kanals weitergeleitet.

Schicke HILFE für eine Auflistung aller erkannten Befehle. Schiche HALLO um dich als Teilnehmer der Liste anzumelden.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Sorry, bei diesem Kanal ist die Hotline Funktion nicht aktiv. Schicke HILFE für eine Auflistung aller erkannten Befehle.'
      : 'Sorry, bei diesem Kanal ist die Hotline Funktion nicht aktiv. Schicke HILFE für eine Auflistung aller erkannten Befehle. Schiche HALLO um dich als Teilnehmer der Liste anzumelden.',

  hotlineReplyOf: ({ messageId, reply }, memberType) => {
    const prefix =
      memberType === memberTypes.ADMIN ? prefixes.hotlineReplyTo(messageId) : prefixes.hotlineReply
    return `[${prefix}]\n${reply}`
  },

  inviteReceived: `Hallo! Sie haben eine Einladung erhalten, diesem Signalboost-Kanal beizutreten. Bitte antworte mit ANNEHMEN oder ABLEHNEN.`,

  invitedToSupportChannel: `Hallo! Dies ist der Signalboost-Unterstützungskanal.
  
Signalboost-Betreuer senden damit gelegentlich Ankündigungen zu neuen Funktionen und beantworten eventuelle Fragen.

Bitte antworten Sie mit ACCEPT, um sich anzumelden, oder DECLINE, um sich nicht anzumelden.`,

  vouchedInviteReceived: (invitesReceived, invitesNeeded) =>
    `Hallo! Du hast ${invitesReceived}/${invitesNeeded} Einladungen, diese Signalboost Kanal beizutreten. ${
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

  destroyChannelFailed: phoneNumber =>
    `Fehler beim Zerstören des Kanals für die Telefonnummer: ${phoneNumber}`,

  safetyNumberChanged:
    'Es sieht so aus, als ob sich Ihre Sicherheitsnummer gerade geändert hat. Möglicherweise müssen Sie Ihre letzte Nachricht erneut senden! :)',

  channelCreationResult: (success, numAvailablePhoneNumbers, numChannels) =>
    `${success ? `Neuer Kanal erstellt.` : `Die Kanalerstellung ist fehlgeschlagen.`}
- ${numChannels} aktive Kanäle
- ${numAvailablePhoneNumbers} verfügbare Telefonnummern`,

  channelCreationError: err => `Fehler beim Erstellen des Kanals: ${err}`,

  restartRequesterNotAuthorized:
    'Versuchen Sie, Signalboost neu zu starten? Sie sind dazu nicht berechtigt!',
  restartChannelNotAuthorized:
    'Versuchen Sie, Signalboost neu zu starten? Sie benutzen dafür den falschen Kanal! Versuchen Sie es erneut auf dem Diagnosekanal.',
  restartPassNotAuthorized:
    'Versuchen Sie, Signalboost neu zu starten? Sie haben dafür die falsche Passphrase verwendet!',
  restartSuccessNotification: adminId => `ADMIN ${adminId} hat den Signalboost neu gestartet.`,
  restartSuccessResponse: 'Signalboost wurde erfolgreich neu gestartet!',
  restartFailure: errorMessage => `Signalboost konnte nicht neu gestartet werden: ${errorMessage}`,

  toRemovedAdmin: adminId =>
    `Soeben wurdest du als Admin von diesem Kanal entfernt von ADMIN ${adminId}. Schicke HALLO um dich wieder anzumelden.`,

  toRemovedSubscriber:
    'Du wurdest gerade von einer/m Admin von diesem Kanal entfernt. Schicke Hallo um dich erneut anzumelden.',

  hotlineToggled: (isOn, adminId) => `ADMIN ${adminId} hat die hotline ${onOrOff(isOn)}.`,

  vouchModeChanged: commandResponses.vouchMode.success,

  vouchLevelChanged: (adminId, vouchLevel) =>
    `ADMIN ${adminId} hat soeben das Vertrauens-Level auf ${vouchLevel} gestellt; um diesem Kanal beizutreten braucht es jetzt ${vouchLevel} ${
      vouchLevel > 1 ? 'Einladungen' : 'Einladung'
    }.`,

  welcome: (addingAdmin, channelPhoneNumber) =>
    `Willkommen! Sie wurden gerade von ${addingAdmin} zum Administrator dieses Signalboost-Kanals ernannt.

1. Fügen Sie diese Telefonnummer (${channelPhoneNumber}) zu Ihren Kontakten hinzu.
2. Senden Sie HELP, um zu sehen, welche Befehle Sie verwenden können.
3. Senden Sie INFO, um zu sehen, wie viele Administratoren und Abonnenten sich auf diesem Kanal befinden.
4. Überprüfen Sie die folgenden Ressourcen:
- https://signalboost.info/how-to
- https://www.instagram.com/_signalboost/
- https://signalboost.info/privacy/

psDer Betrieb jedes Kanals kostet uns ~ 3 US-Dollar pro Monat. Da wir diese Software für die Befreiung und nicht für den Profit entwickeln, sind wir auf die materielle Unterstützung unserer Community angewiesen, um das Projekt am Laufen zu halten. Wenn Sie es sich leisten können, erwägen Sie bitte eine Spende hier: https://signalboost.info/donate 💸`,
}

const prefixes = {
  broadcastMessage: `ÜBERTRAGUNG`,
  fromAdmin: 'VON ADMIN',
  hotlineMessage: messageId => `HOTLINE VON @${messageId}`,
  hotlineReply: `PRIVATE ANTWORT VON ADMINS`,
  hotlineReplyTo: messageId => `HOTLINE AN @${messageId}`,
  notificationHeader: `BENACHRICHTIGUNG`,
  privateMessage: `PRIVAT`,
}

module.exports = {
  commandResponses,
  parseErrors,
  notifications,
  prefixes,
  systemName,
}
