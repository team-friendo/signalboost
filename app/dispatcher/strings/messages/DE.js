const { upperCase } = require('lodash')
const { memberTypes } = require('../../../db/repositories/membership')
const {
  getAdminMemberships,
  getInvites,
  getSubscriberMemberships,
} = require('../../../db/repositories/channel')
const {
  signal: { maxVouchLevel },
} = require('../../../config')

const systemName = 'Signalboost Systemadmins'
const notAdmin =
  'Tut uns leid, nur Admins können diesen Befehl ausführen. Sende HILFE um eine Liste an gültigen Befehlen zu erhalten.'
const notSubscriber =
  'Der Befehl konnte nicht verarbeitet werden, da du kein*e Teilnehmer*in dieses Kanals bist. Schicke HALLO um dich anzumelden.'
const subscriberLimitReached = subscriberLimit =>
  `Entschuldigung, dieser Kanal hat sein Limit von ${subscriberLimit} Abonnent*innen erreicht.`
const onOrOff = isOn => (isOn ? 'an' : 'aus')

const vouchModeDisplay = {
  ON: 'an',
  ADMIN: 'admin',
  OFF: 'aus',
}

const support = `----------------------------
SO FUNKTIONIERT ES
----------------------------

Signalboost hat Kanäle mit Admins und Teilnehmer*innen:

-> Wenn Admins Ankündigungen senden, werden diese an alle Teilnehmer*innen gesendet.
-> Wenn die Hotline-Funktion eingeschaltet ist, können alle Teilnehmer*innen anonym Nachrichten an die Hotline schicken

Signalboost schützt deine Privatsphäre:

-> Nutzer*innen können nie die Telefonnummern anderer Nutzer*innen sehen.
-> Signalboost liest oder speichert nie den Inhalt der Nachrichten.

Signalboost antwortet auf Befehle:

-> Schicke HILFE um sie aufzulisten.

Mehr infos auf: https://signalboost.info`

const validPhoneNumberHint =
  'Telefonnummern müssen mit Ländercodes und einem vorangestellten ' + ' beginnen`'

const parseErrors = {
  missingCommand:
    'Wolltest du dieser Nachricht SENDEN voranstellen? Schicke HILFE für eine Liste aller Befehle.',

  unnecessaryPayload: command =>
    `Sorry, dieser Befehl wurde nicht erkannt.

Wolltest du ${upperCase(command)} oder SENDEN verwenden?

Sende HILFE, um eine Liste aller gültigen Befehle und deren Verwendung zu erhalten.`,

  invalidPhoneNumber: phoneNumber =>
    `"${phoneNumber}" ist keine gültige Telefonnummer. ${validPhoneNumberHint}`,

  invalidPhoneNumbers: phoneNumbers =>
    `"${phoneNumbers.join(', ')}" sind keine gültigen Telefonnummern. ${validPhoneNumberHint}`,

  invalidVouchLevel: vouchLevel =>
    `"${vouchLevel}" ist kein gültiges Vertrauenslevel. Nutze bitte eine Zahl zwischen 1 und ${maxVouchLevel}.`,

  invalidHotlineMessageId: payload =>
    `Hast du versucht, auf eine Hotline-Nachricht zu antworten? Entschuldigung, ${payload} ist keine gültige Hotline-ID. Eine gültige Hotline-ID sieht wie folgt aus: @123`,
}

const invalidPhoneNumber = parseErrors.invalidPhoneNumber

const commandResponses = {
  // ACCEPT

  accept: {
    success: `Hallo! Du hast jetzt diesen Signalboost-Kanal abonniert.

Antworte mit HILFE um mehr zu erfahren oder TSCHÜSS um dich abzumelden.`,
    alreadyMember: 'Ups! Du bist schon Teilnehmer*in an diesem Kanal.',
    belowVouchLevel: (required, actual) =>
      `Entschuldigung, dieser Kanal erfordert ${required} Einladung(en). Du hast ${actual}.`,
    dbError:
      'Tut uns Leid! Es gab einen Fehler beim Versuch dich zum Kanal hinzuzufügen. Bitte versuchs noch einmal!',
    subscriberLimitReached,
  },

  // ADD

  add: {
    banned: bannedNumber => `Es tut uns leid, ${bannedNumber} ist in diesem Kanal gesperrt`,
    dbError: num =>
      `Ups! Es gab einen Fehler beim Versuch ${num} als Admin hinzuzufügen. Bitte versuche es erneut!`,
    invalidPhoneNumber,
    notAdmin,
    success: newAdmin =>
      `${newAdmin.memberPhoneNumber} wurde als ADMIN ${newAdmin.adminId} hinzugefügt.`,
  },

  // BAN
  ban: {
    success: messageId => `Die Absender*in der Hotline-Nachricht ${messageId} wurde gesperrt.`,
    notAdmin,
    doesNotExist:
      'Die Absender*in dieser Hotline-Nachricht ist inaktiv, sodass wir ihre Nachrichtendaten nicht mehr speichern. Bitte versuche es erneut, sobald die Nachricht erneut gesendet wird.',
    alreadyBanned: messageId =>
      `Die Absender*in der Hotline-Nachricht ${messageId} ist bereits gesperrt.`,
    dbError: 'Hoppla! Verbot fehlgeschlagen. Bitte versuche es erneut!',
    invalidHotlineMessageId: messageId =>
      `Entschuldigung, die Hotline-Nachrichten-ID ${messageId} ist abgelaufen oder hat nie existiert.`,
  },

  // BROADCAST
  broadcast: {
    notAdmin,
  },

  // CHANNEL
  channel: {
    success: phoneNumber => `Dein Signalboost-Kanal wurde erstellt! In Kürze solltest du eine Begrüßungsnachricht von deiner Kanal-Telefonnummer erhalten:
${phoneNumber}.

Wenn du Fragen hast oder Probleme beim Zugriff auf deinen Kanal hast, kannst du hier den Signalboost-Support benachrichtigen.
`,
    requestsClosed: `Signalboost ist in der Kapazität! Wir haben Ihre Kanalanfrage an unsere Waitliste hinzugefügt.
    
Wenn die Kapazität frei ist, wird Ihr Kanal erstellt und Sie erhalten eine Begrüßungsnachricht.

Fühlen Sie sich in der Zwischenzeit frei, um uns mit Fragen zu dieser Nummer zu schreiben! 🖤✨🖤.`,
    error: `Entschuldigung, es ist ein Fehler bei der Verarbeitung deiner Kanalanfrage aufgetreten! Bitte versuche es später noch einmal. Wenn dein Problem weiterhin besteht, kannst du hier den Signalboost-Support benachrichtigen.`,
  },

  // DECLINE

  decline: {
    success: 'Einladung abgelehnt. Alle Informationen über die Einladung wurden gelöscht.',
    dbError: 'Ups! Es gab einen Fehler beim Ablehnen der Einladung. Bitte versuchs nochmal!',
  },

  destroy: {
    confirm: `Bist du sicher?

 Wenn du fortfährst, wird dieser Kanal und alle damit verbundenen Daten dauerhaft gelöscht.

 Um fortzufahren, antworte mit:

 BESTÄTIGEN VERNICHTEN`,
    success: 'Der Kanal und alle zugehörigen Daten wurden unwiderrufbar gelöscht.',
    error: 'OH! Es gab einen Fehler beim Zerstören des Kanals! Bitte versuchs nochmal!',
    notAdmin,
  },

  // HELP

  help: {
    admin: `----------------------------------------------3
BEFEHLE
----------------------------------------------

HILFE
-> Zeigt alle Befehle an

INFO
-> Zeigt statistische Infos über den Kanal, und erklärt wie Signalboost funktioniert

----------------------------------------------

SENDEN hallo an alle / ! hallo an alle
-> sendet "hallo an alle" an alle Abonnenten dieses Kanals

@1312
-> Sendet eine private Antwort an [HOTLINE @1312]

EINLADEN +491701234567, +491707654321
-> Lädt +491701234567 und +491707654321 ein, den Kanal zu abonnieren

HINZUFÜGEN +491701234567
-> Fügt +491701234567 als Admin des Kanals hinzu

PRIVAT Hallo Admins / ~ Hallo admins
-> Sendet eine private Nachricht "Hallo Admins" an alle Admins des Kanals

ESPAÑOL / FRANÇAIS / ENGLISH
-> Stellt die Sprache auf Spanisch, Französisch oder Englisch um

HOTLINE AN / AUS
-> Schaltet die Hotline-Funktion an oder aus

VERTRAUEN AN / AUS / ADMIN
-> Schaltet das Verbürgen EIN / AUS. Wenn EIN, müssen Personen eingeladen werden, dem Kanal beizutreten. Bei ADMIN können nur Admins diese Einladungen senden.

VERTRAUENS-LEVEL level
-> Verändert die Zahl der benötigten Einladungen um dem Kanal beitreten zu können

TSCHÜSS
-> Entfernt dich aus diesem Kanal

ENTFERNEN +491701234567
-> +491701234567 als Admin aus dem Kanal entfernt

VERBIETEN @1234
-> Sperrt user @ 1234 vom Senden und Empfangen von Nachrichten aus dem Kanal.

VERNICHTEN
-> Löscht den Kanal und alle zugehörigen Daten unwiderruflich`,

    subscriber: `----------------------------------------------
BEFEHLE
----------------------------------------------

HILFE
-> Zeigt alle Befehle an

INFO
-> Zeigt statistische Infos über den Kanal, und erklärt wie Signalboost funktioniert

----------------------------------------------

EINLADEN +491701234567, +491707654321
-> Lädt +491701234567 und +491707654321 ein, den Kanal zu abonnieren

ESPAÑOL / FRANÇAIS / ENGLISH
-> Stellt die Sprache auf Spanisch, Französisch oder Englisch um

HALLO
-> Macht dich zur Teilnehmer*in am Kanal

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
Teilnehmer*innen: ${getSubscriberMemberships(channel).length}
Teilnehmer*innenlimit: ${channel.subscriberLimit}
Ausstehende Einladungen: ${getInvites(channel).length}
Hotline: ${onOrOff(channel.hotlineOn)}
Vertrauen: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `Vertrauens-Level: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
KANAL INFO:
---------------------------

Du bist als Teilnehmer*in dieses Kanals angemeldet.

Signal-Nummer: ${channel.phoneNumber}
Hotline: ${onOrOff(channel.hotlineOn)}
Vertrauen: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `Vertrauens-Level: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
KANAL INFO:
---------------------------

Du bist nicht bei diesem Kanal angemeldet. Schicke HALLO um dich beim Kanal als Teilnehmer*in anzumelden.

Signal-Nummer: ${channel.phoneNumber}
Teilnehmer*in: ${getSubscriberMemberships(channel).length}

${support}`,
  },

  // INVITE

  invite: {
    adminOnly: 'Leider können nur Admins Personen zu diesem Kanal einladen.',
    bannedInvitees: bannedNumbers =>
      `Es tut uns leid! Die folgenden Nummern sind in diesem Kanal gesperrt: ${bannedNumbers}`,
    dbError: 'Upsi! Einladung konnte nicht verschickt werden. Bitte versuche es erneut :)',
    dbErrors: (failedPhoneNumbers, allPhoneNumbers) =>
      `Upsi! Einladungen konnten nicht gesendet werden für ${failedPhoneNumbers.length} von ${
        allPhoneNumbers.length
      } Telefonnummern.
      
  Bitte versuche erneut, EINLADEN für die folgenden Telefonnummern zu schicken:
  
  ${failedPhoneNumbers.join(',')}`,
    invalidPhoneNumber: input =>
      `Ups! Einladung wurde nicht verschickt. ${invalidPhoneNumber(input)}`,
    notSubscriber,
    subscriberLimitReached: (numInvitees, subscriberLimit, subscriberCount) =>
      `Versuche, ${numInvitees} neue Abonnent*innen einzuladen? Entschuldigung, dieser Kanal ist auf ${subscriberLimit} Abonnent*innen begrenzt und hat bereits ${subscriberCount} Abonnent*innen.`,
    success: n => (n === 1 ? `Einladung versandt.` : `${n} Einladungen wurden verschickt`),
  },

  // JOIN

  join: {
    success: `Hallo! Du hast jetzt diesen Signalboost-Kanal abonniert.

Du kannst jederzeit HILFE senden um mehr zu lernen, oder TSCHÜSS um dich abzumelden.`,
    inviteRequired: `Tut uns leid, für diesen Kanal brauchst du eine Einladung. Frage Freund*innen nach einer Einladung!

Falls du schon eine Einladung erhalten hast, versuche ANNEHMEN zu senden`,
    dbError: `Ups! Es gab einen Fehler beim Versuch dich zum Kanal hinzuzufügen. Bitte versuchs nochmal!`,
    alreadyMember: `Ups! Du bist schon Teilnehmer*in an diesem Kanal.`,
    subscriberLimitReached,
  },

  // LEAVE

  leave: {
    success: `Du wurdest vom Kanal abgemeldet! Tschüss!`,
    error: `Upps! Es gab einen Fehler beim Versuch dich zum Kanal hinzuzufügen. Bitte versuchs noch einmal!`,
    notSubscriber,
  },

  // PRIVATE

  private: {
    notAdmin,
    signalError: `Upps! Beim Versuch, den Admins dieses Kanals eine private Nachricht zu senden, ist ein Fehler aufgetreten. Bitte versuchs erneut!`,
  },

  // REMOVE

  remove: {
    success: num => `${num} wurde entfernt.`,
    notAdmin,
    targetNotMember: num => `Ups! ${num} ist kein*e Teilnehmer*in an diesem Kanal.`,
    dbError: num =>
      `Ups! Es gab einen Fehler beim Versuch ${num} zu entfernen. Bitte versuchs erneut!`,
    invalidPhoneNumber,
  },

  // REPLY

  hotlineReply: {
    success: hotlineReply => notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
    notAdmin,
    invalidMessageId: messageId =>
      `Entschuldigung, die Hotline-Nachrichten-ID @${messageId} ist abgelaufen oder hat nie existiert.`,
  },

  // REQUEST

  request: {
    success: `Hallo! Möchtest du einen Signalboost-Kanal erstellen?

Signalboost ist ein Dienst, mit dem du Nachrichten verschicken und Hotline-Nachrichten empfangen kannst, ohne deine Telefonnummer den Empfänger*innen preiszugeben.

Wenn du dieses Tool verwendest, vertraust du darauf, dass wir die Telefonnummern aller Nutzer*innen deines Kanals gut verwalten:
https://signalboost.info/privacy

Wenn du jetzt einen Kanal erstellen möchtest, sende CHANNEL, gefolgt von einer durch Kommas getrennten Liste von Admin-Telefonnummern mit Ländercodes, zum Beispiel:

CHANNEL +1555123412, +1555123419`,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `Ab jetzt spreche ich mit dir auf Deutsch und du kannst deutsche Befehle schicken!

Sende HILFE um eine Liste der erkannten Befehle zu erhalten.`,
    dbError: 'Upsi! Fehler beim Speichern der Sprachwahl. Bitte versuchs nochmal!',
  },

  // TOGGLES (HOTLINE)

  toggles: {
    hotline: {
      success: isOn => `Hotline  ${onOrOff(isOn)}geschaltet.`,
      notAdmin,
      dbError: isOn =>
        `Upps! Es gab einen Fehler beim Versuch die Hotline-Funktion ${onOrOff(
          isOn,
        )} zu schalten. Bitte versuche es erneut!`,
    },
  },

  // TRUST

  trust: {
    success: phoneNumber => `Sicherheitsnummer für ${phoneNumber} wurde aktualisiert`,
    error: phoneNumber =>
      `Sicherheitsnummer von ${phoneNumber} konnte nicht aktualisiert werden. Versuchs nochmal oder kontaktiere einen Signalboost Maintainer!`,
    invalidPhoneNumber,
    notAdmin,
    dbError: phoneNumber =>
      `Upps! Es gab einen Fehler beim Aktualisieren der Sicherheitsnummer von ${phoneNumber}. Bitte versuchs nochmal!`,
  },

  // VOUCHING
  vouchMode: {
    success: (mode, adminId) => {
      const vouchingStatus = adminId
        ? `ADMIN ${adminId} schaltete das Verbürgen ${vouchModeDisplay[mode]}.`
        : `Verbürgen ist jetzt ${vouchModeDisplay[mode]}.`

      const explanation = {
        ON: `Das bedeutet, dass eine Einladung eines vorhandenen Mitglieds erforderlich ist, um diesem Kanal beizutreten.
Jede*r kann eine Einladung senden, indem sie EINLADEN + 1-555-123-1234 sendet.

Admins können die Anzahl der zum Beitritt erforderlichen Einladungen mithilfe des Befehls VERTRAUENS-LEVEL anpassen.`,
        OFF: `Das bedeutet, dass jede*r dem Kanal beitreten kann, indem sie HALLO an die Kanalnummer sendet.`,
        ADMIN: `
Das bedeutet, dass eine Einladung eines *Admins* erforderlich ist, um diesem Kanal beizutreten.
Jede*r kann eine Einladung senden, indem sie EINLADEN + 1-555-123-1234 sendet.

Admins können die Anzahl der zum Beitritt erforderlichen Einladungen mithilfe des Befehls VERTRAUENS-LEVEL anpassen.`,
      }[mode]

      return `${vouchingStatus}

${explanation}`
    },
    notAdmin,
    dbError:
      'Beim Aktualisieren des Verbürgens für deinen Kanal ist ein Fehler aufgetreten. Bitte versuche es erneut .',
  },

  // VOUCH_LEVEL
  vouchLevel: {
    success: level =>
      `VERTRAUENS-LEVEL auf ${level} gestellt. Jetzt benötigt es ${level} ${
        level > 1 ? 'Einladungen' : 'Einladung'
      } um diesem Kanal als Teilnehmer*in beizutreten.`,
    invalid: parseErrors.invalidVouchLevel,
    notAdmin,
    dbError:
      'Es gab einen Fehler beim Versuch das Vertrauens-Level umzustellen. Bitte versuchs nochmal.',
  },

  // NONE
  none: {
    error:
      'Wolltest du deiner Nachricht SENDEN voranstellen? Sende HILFE, um eine Liste aller Befehle anzuzeigen.',
  },
}

const notifications = {
  adminAdded: (adderAdminId, addedAdminId) =>
    `ADMIN ${adderAdminId} hat ADMIN ${addedAdminId} hinzugefügt.`,

  adminRemoved: (removerAdminId, removedAdminId) =>
    `ADMIN ${removerAdminId} entfernte ADMIN ${removedAdminId}`,

  subscriberRemoved: adminId => `ADMIN ${adminId} hat eine*n Abonnent*in entfernt.`,

  adminLeft: adminId => `ADMIN ${adminId} hat den Kanal verlassen.`,

  banIssued: (adminId, messageId) =>
    `Admin ${adminId} hat die Absender*in der Hotline-Nachricht ${messageId} gesperrt.`,

  banReceived:
    'Ein Admin dieses Kanals hat dich gesperrt. Weitere Interaktionen werden von den Admins des Kanals nicht empfangen.',

  channelCreationResult: (success, numAvailablePhoneNumbers, numChannels) =>
    `${success ? `Neuer Kanal erstellt.` : `Die Kanalerstellung ist fehlgeschlagen.`}
- ${numAvailablePhoneNumbers} verfügbare Telefonnummern
- ${numChannels} aktive Kanäle`,

  channelCreationError: err => `Fehler beim Erstellen des Kanals: ${err}`,

  channelDestroyedByAdmin: (adminId, audience) =>
    ({
      ADMIN: `ADMIN ${adminId} hat diesen Kanal zerstört. Alle zugehörigen Daten wurden gelöscht.`,
      SUBSCRIBER:
        'Der Kanal und alle zugehörigen Daten wurden von den Admins dieses Kanals dauerhaft zerstört.',
    }[audience]),

  channelDestructionScheduled: hoursToLive =>
    `Hallo! Dieser Kanal wird in ${hoursToLive} Stunden aufgrund mangelnder Nutzung zerstört.

Um zu verhindern, dass es zerstört wird, sende INFO innerhalb der nächsten ${hoursToLive} Stunden.

Wenn du den Kanal jetzt zerstören möchtest, antworte mit VERNICHTEN.

Weitere Informationen findest du unter signalboost.info/how-to.`,

  channelDestructionFailed: (phoneNumber, error) =>
    `Der Kanal mit der Signal-Nummer: ${phoneNumber} konnte nicht zerstört werden.
ERROR: ${error}`,

  channelDestroyedBySystem:
    'Kanal wegen mangelnder Nutzung zerstört. Um einen neuen Kanal zu erstellen, besuche https://signalboost.info',

  channelRedeemed:
    'Es war geplant, diesen Kanal wegen mangelnder Nutzung zu zerstören. Da du den Kanal kürzlich verwendet hast, wird er jedoch nicht mehr zerstört. Yay!',

  channelDestructionSucceeded: (numAvailablePhoneNumbers, numChannels) =>
    `Kanal zerstört.
- ${numAvailablePhoneNumbers} verfügbare Telefonnummern
- ${numChannels} aktive Kanäle`,

  safetyNumberChanged:
    'Hallo! Es sieht so aus, als ob sich Ihre Sicherheitsnummer gerade geändert hat (wahrscheinlich, weil Sie Signal neu installiert haben). Wenn Sie gerade eine Nachricht gesendet haben, senden Sie sie bitte erneut. ',

  deauthorization: adminPhoneNumber => `
Admin mit Nummer ${adminPhoneNumber} wurde vom Kanal entfernt weil ihre Sicherheitsnummer sich geändert hat.

Die warscheinlichste Ursache ist die Neuinstallation von Signal auf einem neuen Gerät.
Trotzdem besteht die Möglichkeit dass ein Angreifer sich des Telefons bemächtigt hat und nun versucht sich als diese Person auszugeben.

Setze dich mit ${adminPhoneNumber} in Verbindung um sicherzustellen, dass das Telefon unter ihrer Kontrolle ist. Danach kannst du sie so neu authorisieren:

HINZUFÜGEN ${adminPhoneNumber}

Bis dahin kann ${adminPhoneNumber} weder Nachrichten von diesem Kanal lesen noch welche verschicken`,

  expiryUpdateNotAuthorized:
    'Sorry, nur Admins können den Timer für verschwindende Nachrichten umstellen.',

  hotlineMessageSent: `Deine Nachricht wurde an die Admins dieses Kanals weitergeleitet.

Schicke HILFE für eine Auflistung aller erkannten Befehle. Schicke HALLO um dich als Teilnehmer*in der Liste anzumelden.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Sorry, bei diesem Kanal ist die Hotline-Funktion nicht aktiv. Schicke HILFE für eine Auflistung aller erkannten Befehle.'
      : 'Sorry, bei diesem Kanal ist die Hotline-Funktion nicht aktiv. Schicke HILFE für eine Auflistung aller erkannten Befehle. Schicke HALLO um dich als Teilnehmer*in der Liste anzumelden.',

  hotlineReplyOf: ({ messageId, reply }, memberType) => {
    const prefix =
      memberType === memberTypes.ADMIN ? prefixes.hotlineReplyTo(messageId) : prefixes.hotlineReply
    return `[${prefix}]\n${reply}`
  },

  inviteAccepted: inviteePhoneNumber => `Ihre Einladung zu ${inviteePhoneNumber} wurde akzeptiert!`,

  inviteReceived: `Hallo! Sie haben eine Einladung erhalten, diesem Signalboost-Kanal beizutreten.

Wenn Sie Sendungen von diesem Kanal empfangen möchten, senden Sie hier eine Nachricht mit der Aufschrift "AKZEPTIEREN". Um abzulehnen, senden Sie "DECLINE"`,

  invitedToSupportChannel: `Hallo! Dies ist der Signalboost-Supportkanal.
  
Signalboost-Personal sendet damit gelegentlich Ankündigungen zu neuen Funktionen und beantwortet eventuelle Fragen.

Bitte antworte mit ACCEPT, um dich anzumelden, oder DECLINE, um dich nicht anzumelden.`,

  vouchedInviteReceived: (invitesReceived, invitesNeeded) =>
    `Hallo! Du hast ${invitesReceived}/${invitesNeeded} Einladungen, diese Signalboost-Kanal beizutreten. ${
      invitesReceived === invitesNeeded ? 'Bitte antworte mit ANNEHMEN oder ABLEHNEN.' : ''
    }`,

  promptToUseSignal:
    'Diese Nummer akzeptiert nur Nachrichten, die mit Signal verschickt wurden. Bitte installiere Signal von https://signal.org und versuche es erneut.',

  rateLimitOccurred: (channelPhoneNumber, resendInterval) =>
    `Nachrichtenfrequenz von: ${channelPhoneNumber} ist limitiert.
${
  resendInterval
    ? `nächster Sendeversuch in: ${resendInterval.toString().slice(0, -3)} Sekunden`
    : `Nachricht hat das Limit der Sendeversuche erreicht, es folgen keine weiteren Versuche`
}`,

  restartRequesterNotAuthorized:
    'Versuchst du, Signalboost neu zu starten? Du bist dazu nicht berechtigt!',
  restartChannelNotAuthorized:
    'Versuchst du, Signalboost neu zu starten? Du benutzt dafür den falschen Kanal! Versuche es erneut auf dem Diagnosekanal.',
  restartPassNotAuthorized:
    'Versuchst du, Signalboost neu zu starten? Du hast dafür das falsche Passphrase verwendet!',
  restartSuccessNotification: adminId => `ADMIN ${adminId} hat den Signalboost neu gestartet.`,
  restartSuccessResponse: 'Signalboost wurde erfolgreich neu gestartet!',
  restartFailure: errorMessage => `Signalboost konnte nicht neu gestartet werden: ${errorMessage}`,

  toRemovedAdmin: adminId =>
    `Soeben wurdest du als Admin von diesem Kanal entfernt durch ADMIN ${adminId}. Schicke HALLO um dich wieder anzumelden.`,

  toRemovedSubscriber:
    'Du wurdest gerade von einer/m Admin von diesem Kanal entfernt. Schicke Hallo um dich erneut anzumelden.',

  hotlineToggled: (isOn, adminId) => `ADMIN ${adminId} hat die Hotline ${onOrOff(isOn)}.`,

  vouchModeChanged: commandResponses.vouchMode.success,

  vouchLevelChanged: (adminId, vouchLevel) =>
    `ADMIN ${adminId} hat soeben das Vertrauens-Level auf ${vouchLevel} gestellt; um diesem Kanal beizutreten braucht es jetzt ${vouchLevel} ${
      vouchLevel > 1 ? 'Einladungen' : 'Einladung'
    }.`,

  welcome: (addingAdmin, channelPhoneNumber) =>
    `Willkommen! Du wurdest gerade von ${addingAdmin} zum Admin dieses Signalboost-Kanals ernannt.

1. Füge diese Telefonnummer (${channelPhoneNumber}) zu deinen Kontakten hinzu.
2. Sende HELP um zu sehen, welche Befehle du verwenden kannst.
3. Sende INFO um zu sehen, wie viele Admins und Abonnent*innen sich auf diesem Kanal befinden.
4. Weitere Informationen:
- https://signalboost.info/how-to
- https://www.instagram.com/_signalboost/
- https://signalboost.info/privacy/

P.S: Der Betrieb jedes Kanals kostet uns ~ 3 US-Dollar pro Monat. Da wir diese Software für die freiheitliche Zwecke und nicht für den Profit entwickeln, sind wir auf materielle Unterstützung angewiesen, um das Projekt am Laufen zu halten. Wenn du es dir leisten kannst, erwäge bitte eine Spende: https://signalboost.info/donate 💸`,
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
