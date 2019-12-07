const { upperCase } = require('lodash')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')

const systemName = 'le maintenant du système Signalboost'
const unauthorized = 'Oups! Vous n’êtes pas autorisé de faire cela sur ce canal.'
const invalidNumber = phoneNumber =>
  `Oups! "${phoneNumber}" n’est pas un numéro de téléphone valide. Les numéros de téléphone doivent comprendre le code pays précédé par un «+».`

const support = `----------------------------
COMMENT ÇA FONCTIONNE
----------------------------

Un canal de Signalboost ont des administratrices-teurs et des abonnéEs.

-> Lorsque les administratrices-teurs transmettent des messages, ces messages sont envoyés à touTEs les abonnéEs.
-> Si activé, les abonnéEs peuvent envoyer des réponses que seulEs les administratrices-teurs peuvent lire.
-> Les abonnéEs ne peuvent pas envoyer des messages entre elleux. (Pas de cacophonie!)

Un canal de Signalboost comprennent des commandes.

-> AIDE affiche le menu des commandes.
-> On peut s’abonner en utilisant la commande ALLÔ, ou se désabonner avec ADIEU.
-> Envoyer le nom d’une langue (par exemple: ESPAÑOL ou ANGLAIS) changera la langue.

Signalboost tente de préserver votre intimité.

-> Les usagers ne peuvent pas voir les numéros de téléphone des autres usagers.
-> Signalboost ne lit pas et ne conserve aucun de vos messages.

Pour plus de renseignements: https://signalboost.info`

const notifications = {
  adminAdded: commandIssuer => `Nouvelle-eau Admin ${addedAdmin} ajoutéE par ${commandIssuer}`,

  broadcastResponseSent: channel =>
    `Votre message a été communiqué aux Admins de [${channel.name}]. 
    Commande AIDE pour le menu des commandes que je maîtrise! :)`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} a été retiré de ce canal parce que leur numéro de sécurité a été modifié.

Ceci est presque certainement parce qu’ielles ont réinstallé Signal sur un nouvel appareil.

Cependant, il y a un petit risque que leur téléphone soit compromis et tente de se faire passer pour elleux.

Vérifiez auprès de ${adminPhoneNumber} pour vous assurer qu’ielles contrôlent toujours leur appareil, et vous pouvez par la suite les revalider avec:
AJOUTER ${adminPhoneNumber}

Ielles seront incapables d’envoyer ou de lire des messages sur ce canal avant que cette étape soit complétée.`,
  noop: "Oups! Ceci n’est pas une commande!",
  unauthorized: "Oups! Les réponses d’abonnéEs sont désactivées. Pour le moment, ce canal acceptera uniquement des commandes. Commande AIDE pour voir le menu de commandes que je maîtrise!",

  welcome: (addingAdmin, channelPhoneNumber) => `
Vous êtes maintenant unE admin de ce canal Signalboost grâce à ${addingAdmin}. BienvenuE!

On peut aussi s’abonner à ce canal avec la commande ALLÔ au ${channelPhoneNumber}, et se désabonner avec la commande ADIEU.

Commande AIDE pour plus de renseignements.`,

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Demande d’abonnement reçu provenant de ${senderNumber}:\n ${requestMsg}`,

  signupRequestResponse:
    'Merci pour votre abonnement avec Signalboost! Vous recevrez bientôt un message d’accueil sur votre nouveau canal...',
}

const commandResponses = {
  // ADD

  add: {
    success: num => `${num} added as an admin.`,
    unauthorized,
    dbError: num => `Whoops! There was an error adding ${num} as an admin. Please try again!`,
    invalidNumber,
  },

  // REMOVE

  remove: {
    success: num => `${num} removed as an admin.`,
    unauthorized,
    dbError: num => `Whoops! There was an error trying to remove ${num}. Please try again!`,
    invalidNumber,
    targetNotAdmin: num => `Whoops! ${num} is not an admin. Can't remove them.`,
  },

  // HELP

  help: {
    admin: `----------------------------------------------
COMMANDS I UNDERSTAND
----------------------------------------------

HELP
-> lists commands

INFO
-> shows stats, explains how Signalboost works

RENAME new name
-> renames channel to "new name"

ADD +1-555-555-5555
-> makes +1-555-555-5555 an admin

REMOVE +1-555-555-5555
-> removes +1-555-555-5555 as an admin

RESPONSES ON
-> allows subscribers to send messages to admins

RESPONSES OFF
-> disables subscribers from sending messages to admins

GOODBYE
-> leaves this channel

ESPAÑOL
-> switches language to Spanish`,

    subscriber: `----------------------------------------------
COMMANDS I UNDERSTAND
----------------------------------------------

HELP
-> lists commands

INFO
-> shows stats, explains how signalboost works

HELLO
-> subscribes you to announcements

GOODBYE
-> unsubscribes you from announcements`,
  },

  // INFO

  info: {
    admin: channel => `---------------------------
CHANNEL INFO:
---------------------------

name: ${channel.name}
phone number: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
subscribers: ${getSubscriberMemberships(channel).length}
responses: ${channel.responsesEnabled ? 'ON' : 'OFF'}
messages sent: ${channel.messageCount.broadcastIn}

${support}`,

    subscriber: channel => `---------------------------
CHANNEL INFO:
---------------------------

name: ${channel.name}
phone number: ${channel.phoneNumber}
responses: ${channel.responsesEnabled ? 'ON' : 'OFF'}
subscribers: ${getSubscriberMemberships(channel).length}

${support}`,
    unauthorized,
  },

  // RENAME

  rename: {
    success: (oldName, newName) =>
      `[${newName}]\nChannel renamed from "${oldName}" to "${newName}".`,
    dbError: (oldName, newName) =>
      `[${oldName}]\nWhoops! There was an error renaming the channel [${oldName}] to [${newName}]. Try again!`,
    unauthorized,
  },

  // JOIN

  join: {
    success: channel => {
      const { name } = channel
      return `
Welcome to Signalboost! You are now subscribed to the [${name}] channel.

Reply with HELP to learn more or GOODBYE to unsubscribe.`
    },
    dbError: `Whoops! There was an error adding you to the channel. Please try again!`,
    alreadyMember: `Whoops! You are already a member of this channel.`,
  },

  // LEAVE

  leave: {
    success: `You've been removed from the channel! Bye!`,
    error: `Whoops! There was an error removing you from the channel. Please try again!`,
    unauthorized,
  },

  // RESPONSES_ON / RESPONSES_OFF

  toggleResponses: {
    success: setting => `Subscriber responses turned ${upperCase(setting)}.`,
    unauthorized,
    dbError: setting =>
      `Whoops! There was an error trying to set responses to ${setting}. Please try again!`,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: 'Je vous parlerai maintenant en français! Commande AIDE pour le menu des commandes que je maîtrise.',
    dbError: 'Whoops! Failed to store your language preference. Please try again!',
  },

  // TRUST

  trust: {
    success: phoneNumber => `Updated safety number for ${phoneNumber}`,
    error: phoneNumber =>
      `Failed to update safety number for ${phoneNumber}. Try again or contact a maintainer!`,
    invalidNumber,
    unauthorized,
    dbError: phoneNumber =>
      `Whoops! There was an error updating the safety number for ${phoneNumber}. Please try again!`,
  },
}

const prefixes = {
  broadcastResponse: `SUBSCRIBER RESPONSE:`,
}

const EN = {
  commandResponses,
  notifications,
  prefixes,
  systemName,
}

module.exports = EN
