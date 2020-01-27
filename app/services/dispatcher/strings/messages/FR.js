const { memberTypes } = require('../../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')

const systemName = 'le maintenant du système Signalboost'
const notAdmin =
  'Désolé, seuls les admins sont autorisés à exécuter cette commande. Envoyez AIDE pour une liste de commandes valides.'
const notSubscriber =
  "Votre commande n'a pas pu être traitée car vous n'êtes pas abonné à cette canal. Envoyez BONJOUR pour vous abonner."

const onOrOff = isOn => (isOn ? 'activées' : 'désactivées')

const support = `----------------------------------------------
COMMENT ÇA FONCTIONNE
----------------------------------------------

Signalboost dispose de canaux avec des administrateurs et des abonnés:

-> Lorsque les adminis transmettent des messages, ces messages sont envoyés à toutes les abonnées.
-> Si activé, les abonnés peuvent envoyer des messages anonymes à la hotline.

Signalboost protège votre vie privée:

-> Les usagers ne peuvent pas voir les numéros de téléphone des autres usagers. (Les flics ne peuvent pas non plus!)
-> Signalboost ne lit pas et ne conserve aucun de vos messages.

Signalboost répond aux commandes:

-> AIDE affiche le menu des commandes.

Pour plus de renseignements: https://signalboost.info`

const parseErrrors = {
  invalidPhoneNumber: phoneNumber =>
    `Oups! "${phoneNumber}" n’est pas un numéro de téléphone valide. Les numéros de téléphone doivent comprendre le code pays précédé par un «+».`,
}

const invalidPhoneNumber = parseErrrors.invalidPhoneNumber

const commandResponses = {
  // ACCEPT

  accept: {
    success: channel => `Bonjour! Vous êtes maintenant abonnée au/à le [${
      channel.name
    }] canal Signalboost. ${channel.description}

Répondez avec AIDE pour en savoir plus ou ADIEU pour vous désinscrire.`,
    alreadyMember: 'Désolé, vous êtes déjà membre de cette canal',
    belowThreshold: (channel, required, actual) =>
      `Désolé, ${
        channel.name
      } nécessite ${required} invitation(s) pour rejoindre. Vous avez ${actual}.`,
    dbError:
      "Oups! Une erreur s'est produite lors de l'acceptation de votre invitation. Veuillez réessayer!",
  },

  // ADD

  add: {
    success: num => `${num} ajoutée comme admin.`,
    notAdmin,
    dbError: num =>
      `Oups! Une erreur s’est produite en tentant de supprimer ${num}. Veuillez essayer de nouveau.`,
    invalidPhoneNumber,
  },

  // DECLINE

  decline: {
    success: `Invitation refusée. Toutes les informations sur l'invitation ont été supprimées.`,
    dbError: `Oups! Une erreur s'est produite lors du refus de l'invitation. Veuillez réessayer!`,
  },

  // HELP

  help: {
    admin: `----------------------------------------------
COMMANDES
----------------------------------------------

AIDE
-> menu des commandes

INFO
-> affiche les stats, explique le fonctionnement de Signalboost

----------------------------------------------

RENOMMER nouveau nom
-> renomme le canal au “nouveau nom”

DESCRIPTION description de le canal
-> ajoute ou met à jour la description publique de le canal

AJOUTER / SUPPRIMER +1-555-555-5555
-> ajoute ou supprime + 1-555-555-5555 en tant qu'administrateur de le canal

HOTLINE ACTIVÉES / DÉSACTIVÉES
-> active ou désactive hotline

SE PORTER GARANT ACTIVÉES / DÉSACTIVÉES
-> active ou désactive l'exigence de recevoir une invitation à s'abonner

ESPAÑOL / ENGLISH
-> change la langue au Español or Anglais

ADIEU
-> désabonnement de le canal`,

    subscriber: `----------------------------------------------
COMMANDES
----------------------------------------------

AIDE
-> menu des commandes

INFO
-> affiche les stats, explique le fonctionnement de Signalboost

----------------------------------------------

INVITER
-> invite + 1-555-555-5555 à s'abonner à le canal

ESPAÑOL / ENGLISH
-> change la langue au Español or Anglais

ALLÔ
-> abonnement aux avis

ADIEU
-> désabonnement des avis`,
  },

  // INFO

  info: {
    [memberTypes.ADMIN]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous êtes admin de cette canal.

nom: ${channel.name}
numéro de téléphone: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
abonnées: ${getSubscriberMemberships(channel).length}
hotline: ${channel.hotlineOn ? 'activée' : 'désactivée'}
se porter garant: ${onOrOff(channel.vouchingOn)}
${channel.description ? `description: ${channel.description}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous êtes abonné a cette canal.

nom: ${channel.name}
numéro de téléphone: ${channel.phoneNumber}
hotline: ${channel.hotlineOn ? 'activée' : 'désactivée'}
se porter garant: ${onOrOff(channel.vouchingOn)}
abonnées: ${getSubscriberMemberships(channel).length}
${channel.description ? `description: ${channel.description}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous n'êtes pas abonné à cette canal. Envoyez AIDE pour vous abonner.

nom: ${channel.name}
numéro de téléphone: ${channel.phoneNumber}
abonnées: ${getSubscriberMemberships(channel).length}
${channel.description ? `description: ${channel.description}` : ''}

${support}`,
  },

  // INVITE

  invite: {
    notSubscriber,
    invalidPhoneNumber: input =>
      `Oups! Échec de l'émission de l'invitation. ${invalidPhoneNumber(input)}`,
    success: `Invitation émise.`,
    dbError: `Oups! Échec de l'émission de l'invitation. Veuillez réessayer. :)`,
  },

  // JOIN

  join: {
    success: channel =>
      `Bonjour! Vous êtes maintenant abonnée au/à le [${channel.name}] canal Signalboost. ${
        channel.description
      }

Répondez avec AIDE pour en savoir plus ou ADIEU pour vous désinscrire.`,
    inviteRequired: `Pardon! Les invitations sont nécessaires pour s'abonner à cette canal. Demandez à un ami de vous inviter!

Si vous avez déjà une invitation, essayez d'envoyer ACCEPTER`,
    dbError: `Oups! Une erreur s’est produite en tentant de vous ajouter à le canal. Veuillez essayer de nouveau!`,
    alreadyMember: `Oups! Vous êtes déjà abonnée à ce canal.`,
  },

  // LEAVE

  leave: {
    success: `Vous êtes maintenant désabonnée de ce canal. Au revoir!`,
    error: `Oups! Une erreur s’est produite en tentant de vous désabonner de ce canal. Veuillez essayer de nouveau!`,
    notSubscriber,
  },

  // REMOVE

  remove: {
    success: num => `${num} supprimé en tant qu'admin.`,
    notAdmin,
    dbError: num =>
      `Oups! Une erreur s'est produite lors de la tentative de suppression ${num}. Veuillez essayer de nouveau.`,
    invalidPhoneNumber,
    targetNotAdmin: num => `Oups! ${num} n’est pas une admin. Ielle ne peut être supprimée.`,
  },

  // RENAME

  rename: {
    success: (oldName, newName) => `[${newName}]\nCanal nom changé de "${oldName}" à "${newName}”.`,
    dbError: (oldName, newName) =>
      `[${oldName}]\nOups! Une erreur s’est produite en tentant de renommer le canal de [${oldName}] à [${newName}]. Veuillez essayer de nouveau!`,
    notAdmin,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `Je vous parlerai maintenant en français!
    
Commande AIDE pour le menu des commandes que je maîtrise.`,
    dbError: 'Oups! Votre langage de préférence n’a pas été conservé. Veuillez essayer de nouveau!',
  },

  // TOGGLES (HOTLINE, VOUCHING)

  toggles: {
    hotline: {
      success: isOn => `Hotline ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `Oups! Une erreur s’est produite en tentant de changer la hotline à ${onOrOff(
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
    invalidPhoneNumber,
    notAdmin,
    dbError: phoneNumber =>
      `Oups! Une erreur s’est produite lors de la mise à jour du numéro de sécurité à ${phoneNumber}. Veuillez essayer à nouveau!`,
  },

  // SET_DESCRIPTION

  description: {
    success: newDescription =>
      `La description de le canal a été remplacée par "${newDescription}".`,
    dbError: `Oups! Une erreur s'est produite lors du changement de la description de le canal. ¡Inténtalo de nuevo!`,
    notAdmin,
  },
}

const notifications = {
  adminAdded: (commandIssuer, addedAdmin) =>
    `Nouvelle-eau Admin ${addedAdmin} ajouté par ${commandIssuer}`,

  adminRemoved: "Un administrateur vient d'être supprimé.",

  adminLeft: 'Un administrateur vient de quitter le canal',

  channelRecycled:
    "Chaîne désactivée par manque d'utilisation. Pour créer une nouvelle chaîne, visitez https://signalboost.info",

  channelRenamed: (oldName, newName) => `Canal renommée à partir de "${oldName}" to "${newName}."`,

  setDescription: newDescription => `Description de le canal définie sur "${newDescription}."`,

  expiryUpdateNotAuthorized:
    "Désolé, seuls les admins peuvent régler l'horloge des messages disparus.",

  hotlineMessageSent: channel =>
    `Votre message a été transmis de manière anonyme aux admins de [${channel.name}].

Envoyez HELP pour répertorier les commandes valides. Envoyez ALLÔ pour vous abonner.

(Remarque: tous les messages sont transmis de manière anonyme. Indiquez votre numéro de téléphone si vous souhaitez que les administrateurs vous répondent individuellement.)`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Désolé, la hotline ne sont pas activés sur cette canal. Envoyez AIDE pour répertorier les commandes valides.'
      : 'Désolé, la hotline ne sont pas activés sur cette canal. Envoyez AIDE pour lister les commandes valides ou ALLÔ pour vous abonner.',

  inviteReceived: channelName => `Vous avez été invité sur le  [${channelName}] canal Signalboost. Souhaitez-vous vous abonner aux annonces de cette canal?

Veuillez répondre avec ACCEPTER ou REFUSER.`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} a été retiré de ce canal parce que leur numéro de sécurité a été modifié.

Ceci est presque certainement parce qu’ielles ont réinstallé Signal sur un nouvel appareil.

Cependant, il y a un petit risque que leur téléphone soit compromis et tente de se faire passer pour elleux.

Vérifiez auprès de ${adminPhoneNumber} pour vous assurer qu’ielles contrôlent toujours leur appareil, et vous pouvez par la suite les revalider avec:

AJOUTER ${adminPhoneNumber}

Ielles seront incapables d’envoyer ou de lire des messages sur ce canal avant que cette étape soit complétée.`,
  noop: 'Oups! Ceci n’est pas une commande!',
  unauthorized:
    'Oups! La hotline est désactivée. Pour le moment, ce canal acceptera uniquement des commandes. Commande AIDE pour voir le menu de commandes que je maîtrise!',

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Demande d’abonnement reçu provenant de ${senderNumber}:\n ${requestMsg}`,

  signupRequestResponse:
    'Merci pour votre abonnement avec Signalboost! Vous recevrez bientôt un message d’accueil sur votre nouveau canal...',

  toRemovedAdmin:
    "Vous venez d'être supprimé en tant qu'administrateur de cette chaîne. Envoyez BONJOUR pour vous réinscrire.",

  toggles: commandResponses.toggles,

  rateLimitOccurred: (channelPhoneNumber, memberPhoneNumber, resendInterval) =>
    `Un message n'a pas pu être envoyé en raison d'une erreur de limite de débit.
canal: ${channelPhoneNumber}
destinataire: ${memberPhoneNumber}
${
  resendInterval
    ? `tentative sera faite pour renvoyer le message en: ${resendInterval.toString().slice(0, -3)}s`
    : `le message a dépassé le seuil de renvoi et ne sera pas renvoyé`
}`,

  recycleChannelFailed: phoneNumber =>
    `Échec du recyclage de la chaîne pour le numéro de téléphone: ${phoneNumber}`,

  welcome: (addingAdmin, channelPhoneNumber) =>
    `Vous êtes maintenant un
 admin de ce canal Signalboost grâce à ${addingAdmin}. Bienvenue!

On peut aussi s’abonner à ce canal avec la commande ALLÔ au ${channelPhoneNumber}, et se désabonner avec la commande ADIEU.

Commande AIDE pour plus de renseignements.`,
}

const prefixes = {
  hotlineMessage: `HOTLINE`,
}

module.exports = {
  commandResponses,
  notifications,
  parseErrrors,
  prefixes,
  systemName,
}
