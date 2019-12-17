const { upperCase } = require('lodash')
const { memberTypes } = require('../../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')

const systemName = 'le maintenant du système Signalboost'
const notAdmin =
  'Désolé, seuls les admins sont autorisés à exécuter cette commande. Envoyez AIDE pour une liste de commandes valides.'
const notSubscriber =
  "Votre commande n'a pas pu être traitée car vous n'êtes pas abonné à cette chaîne. Envoyez BONJOUR pour vous abonner."

const invalidNumber = phoneNumber =>
  `Oups! "${phoneNumber}" n’est pas un numéro de téléphone valide. Les numéros de téléphone doivent comprendre le code pays précédé par un «+».`
const onOrOff = isOn => (isOn ? 'activées' : 'désactivées')

const support = `----------------------------
COMMENT ÇA FONCTIONNE
----------------------------

Un canal de Signalboost ont des administratrices-teurs et des abonnées.

-> Lorsque les administratrices-teurs transmettent des messages, ces messages sont envoyés à toutes les abonnées.
-> Si activé, les abonnées peuvent envoyer des réponses que seules les administratrices-teurs peuvent lire.
-> Les abonnés ne peuvent pas envoyer des messages entre elleux. (Pas de cacophonie!)

Un canal de Signalboost comprennent des commandes.

-> AIDE affiche le menu des commandes.
-> On peut s’abonner en utilisant la commande ALLÔ, ou se désabonner avec ADIEU.
-> Envoyer le nom d’une langue (par exemple: ESPAÑOL ou ANGLAIS) changera la langue.

Signalboost tente de préserver votre intimité.

-> Les usagers ne peuvent pas voir les numéros de téléphone des autres usagers.
-> Signalboost ne lit pas et ne conserve aucun de vos messages.

Pour plus de renseignements: https://signalboost.info`

const notifications = {
  adminAdded: (commandIssuer, addedAdmin) =>
    `Nouvelle-eau Admin ${addedAdmin} ajouté par ${commandIssuer}`,

  hotlineMessageSent: channel =>
    `Votre message a été transmis de manière anonyme aux admins de [${
      channel.name
    }]. Indiquez votre numéro de téléphone si vous souhaitez que les administrateurs vous répondent individuellement.'

Send HELP to list valid commands.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Désolé, les messages entrants ne sont pas activés sur cette chaîne. Envoyez AIDE pour répertorier les commandes valides.'
      : 'Désolé, les messages entrants ne sont pas activés sur cette chaîne. Envoyez AIDE pour lister les commandes valides ou BONJOUR pour vous abonner.',

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} a été retiré de ce canal parce que leur numéro de sécurité a été modifié.

Ceci est presque certainement parce qu’ielles ont réinstallé Signal sur un nouvel appareil.

Cependant, il y a un petit risque que leur téléphone soit compromis et tente de se faire passer pour elleux.

Vérifiez auprès de ${adminPhoneNumber} pour vous assurer qu’ielles contrôlent toujours leur appareil, et vous pouvez par la suite les revalider avec:

AJOUTER ${adminPhoneNumber}

Ielles seront incapables d’envoyer ou de lire des messages sur ce canal avant que cette étape soit complétée.`,
  noop: 'Oups! Ceci n’est pas une commande!',
  unauthorized:
    'Oups! Les réponses d’abonnées sont désactivées. Pour le moment, ce canal acceptera uniquement des commandes. Commande AIDE pour voir le menu de commandes que je maîtrise!',

  welcome: (addingAdmin, channelPhoneNumber) => `
Vous êtes maintenant un
 admin de ce canal Signalboost grâce à ${addingAdmin}. Bienvenue!

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
    success: num => `${num} ajoutée comme admin.`,
    notAdmin,
    dbError: num =>
      `Oups! Une erreur s’est produite en tentant de supprimer ${num}. Veuillez essayer de nouveau.`,
    invalidNumber,
  },

  // REMOVE

  remove: {
    success: num => `${num} supprimé en tant qu'admin.`,
    notAdmin,
    dbError: num =>
      `Oups! Une erreur s'est produite lors de la tentative de suppression ${num}. Veuillez essayer de nouveau.`,
    invalidNumber,
    targetNotAdmin: num => `Oups! ${num} n’est pas une admin. Ielle ne peut être supprimée.`,
  },

  // HELP

  help: {
    admin: `----------------------------------------------
COMMANDES QUE JE MAITRÎSE
----------------------------------------------

AIDE
-> menu des commandes

INFO
-> affiche les stats, explique le fonctionnement de Signalboost

RENOMMER nouveau nom
-> renomme le canal au “nouveau nom”

AJOUTER +1-555-555-5555
-> ajoute +1-555-555-5555 comme admin

SUPPRIMER +1-555-555-5555
-> supprime +1-555-555-5555 en tant qu’admin

RÉPONSES ACTIVÉES
-> permet aux abonnées d’envoyer des messages aux admins

RÉPONSES DÉSACTIVÉES
-> désactive la capacité des abonnées d’envoyer des messages aux admins

ADIEU
-> désabonnement de la canal 

ESPAÑOL / ENGLISH
-> change la langue au Español or Anglais`,

    subscriber: `----------------------------------------------
COMMANDES QUE JE MAITRÎSE
----------------------------------------------

AIDE
-> menu des commandes

INFO
-> affiche les stats, explique le fonctionnement de Signalboost

ALLÔ
-> abonnement aux avis

ADIEU
-> désabonnement des avis

ESPAÑOL / ENGLISH
-> change la langue au Español or Anglais`,
  },

  // INFO

  info: {
    [memberTypes.ADMIN]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous êtes admin de cette chaîne.

nom: ${channel.name}
numéro de téléphone: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
abonnées: ${getSubscriberMemberships(channel).length}
réponses: ${channel.responsesEnabled ? 'ON' : 'OFF'}
messages envoyés: ${channel.messageCount.broadcastIn}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous êtes abonné a cette chaîne.

nom: ${channel.name}
numéro de téléphone: ${channel.phoneNumber}
réponses: ${channel.responsesEnabled ? 'ON' : 'OFF'}
abonnées: ${getSubscriberMemberships(channel).length}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous n'êtes pas abonné à cette chaîne. Envoyez AIDE pour vous abonner.

nom: ${channel.name}
numéro de téléphone: ${channel.phoneNumber}
abonnées: ${getSubscriberMemberships(channel).length}

${support}`,
  },

  // RENAME

  rename: {
    success: (oldName, newName) => `[${newName}]\nCanal nom changé de "${oldName}" à "${newName}”.`,
    dbError: (oldName, newName) =>
      `[${oldName}]\nOups! Une erreur s’est produite en tentant de renommer le canal de [${oldName}] à [${newName}]. Veuillez essayer de nouveau!`,
    notAdmin,
  },

  // JOIN

  join: {
    success: channel =>
      `Bienvenue à Signalboost! Vous êtes maintenant abonnée au/à la [${channel.name}] canal.

Répondez avec AIDE pour en savoir plus ou ADIEU pour vous désinscrire.`,
    dbError: `Oups! Une erreur s’est produite en tentant de vous ajouter à la canal. Veuillez essayer de nouveau!`,
    alreadyMember: `Oups! Vous êtes déjà abonnée à ce canal.`,
  },

  // LEAVE

  leave: {
    success: `Vous êtes maintenant désabonnée de ce canal. Au revoir!`,
    error: `Oups! Une erreur s’est produite en tentant de vous désabonner de ce canal. Veuillez essayer de nouveau!`,
    notSubscriber,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `Je vous parlerai maintenant en français!
    
Commande AIDE pour le menu des commandes que je maîtrise.`,
    dbError: 'Oups! Votre langage de préférence n’a pas été conservé. Veuillez essayer de nouveau!',
  },

  // TOGGLES (RESPONSES, VOUCHING)

  toggles: {
    responses: {
      success: isOn => `Réponses des abonnées maintenant ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `Oups! Une erreur s’est produite en tentant de changer les réponses à ${onOrOff(
          isOn,
        )}. Veuillez essayer de nouveau!`,
    },
    vouching: {
      success: isOn => `se porter garant maintenant ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `Oups! Une erreur s’est produite en tentant de changer se porter garant à ${onOrOff(
          isOn,
        )}. Veuillez essayer de nouveau!`,
    },
  },

  // TRUST

  trust: {
    success: phoneNumber => `Mise à jour du numéro de sécurité à ${phoneNumber}`,
    error: phoneNumber =>
      `La mise à jour du numéro de sécurité à ${phoneNumber} a échoué. Veuillez essayer à nouveau ou contactez une mainteneur!`,
    invalidNumber,
    notAdmin,
    dbError: phoneNumber =>
      `Oups! Une erreur s’est produite lors de la mise à jour du numéro de sécurité à ${phoneNumber}. Veuillez essayer à nouveau!`,
  },
}

const prefixes = {
  hotlineMessage: `RÉPONSES ABONNÉeS`,
}

module.exports = {
  commandResponses,
  notifications,
  prefixes,
  systemName,
}
