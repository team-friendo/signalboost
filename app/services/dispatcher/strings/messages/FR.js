const { memberTypes } = require('../../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')
const {
  signal: { maxVouchLevel },
} = require('../../../../config')

const systemName = "l'admin système de signalboost"
const notAdmin =
  'Désolé, seul-e-s les admins sont autorisé-e-s à exécuter cette commande. Envoyez AIDE pour une liste de commandes valides.'
const notSubscriber =
  "Votre commande n'a pas pu être traitée car vous n'êtes pas abonné-e à ce canal. Envoyez BONJOUR pour vous abonner."

const onOrOff = isOn => (isOn ? 'activée' : 'désactivée')

const support = `----------------------------------------------
COMMENT ÇA FONCTIONNE
----------------------------------------------

Signalboost dispose de canaux avec des admins et des abonné-e-s :

-> Lorsque les admins envoient des messages, ils sont transmis à tou-te-s les abonné-e-s.
-> Si l’option Hotline est activé, les abonné-e-s peuvent envoyer des messages anonymes aux admins du canal.

Signalboost protège votre vie privée :

-> Les utilisateurices ne peuvent pas voir les numéros de téléphone des autres usagèr-e-s. (Les flics ne peuvent pas non plus!)
-> Signalboost ne lit pas et ne conserve aucun de vos messages.

Signalboost répond aux commandes:

-> AIDE affiche le menu des commandes.

Pour plus de renseignements: https://signalboost.info`

const parseErrors = {
  invalidPhoneNumber: phoneNumber =>
    `Oups! "${phoneNumber}" n’est pas un numéro de téléphone valide. Les numéros de téléphone doivent comprendre l’indicatifs téléphonique du pays précédé par un «+».`,
  invalidVouchLevel: invalidVouchLevel =>
    `"${invalidVouchLevel} n'est pas un niveau de porter garant valide. Veuillez utiliser un nombre compris entre 1 et ${maxVouchLevel}.`,
}

const invalidPhoneNumber = parseErrors.invalidPhoneNumber

const commandResponses = {
  // ACCEPT

  accept: {
    success: channel => `Bonjour! Vous êtes maintenant abonné e au canal Signalboost [${
      channel.name
    }] . ${channel.description}

Répondez avec AIDE pour en savoir plus ou ADIEU pour vous désinscrire.`,
    alreadyMember: 'Désolé, vous êtes déjà membre de ce canal',
    belowVouchLevel: (channel, required, actual) =>
      `Désolé, ${
        channel.name
      } nécessite ${required} invitation(s) pour rejoindre. Vous avez ${actual}.`,
    dbError:
      "Oups! Une erreur s'est produite lors de l'acceptation de votre invitation. Veuillez réessayer!",
  },

  // ADD

  add: {
    success: num => `${num} a été ajouté e comme admin.`,
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

  destroy: {
    success: `La chaîne et tous les enregistrements associés ont été définitivement détruits.`,
    error: `Oups! Une erreur s'est produite lors de la destruction de la chaîne. Veuillez réessayer!`,
  },

  // HELP

  help: {
    admin: `----------------------------------------------
COMMANDES
----------------------------------------------

AIDE
-> Menu des commandes

INFO
-> Afficher les stats, expliquer le fonctionnement de Signalboost

----------------------------------------------

RENOMMER nouveau nom
-> Renommer le canal en “nouveau nom”

DESCRIPTION description du canal
-> Ajouter ou mettre à jour la description publique du canal

INVITE +33612345678
-> Inviter +33612345678 à s’inscrire au canal

AJOUTER / SUPPRIMER +33612345678
-> Ajouter ou supprimer +33612345678 en tant qu'admin du canal

HOTLINE ON / OFF
-> Activer ou désactiver la hotline

SE PORTER GARANT ON / OFF
-> Activer ou désactiver l'exigence de recevoir une invitation à s'abonner

NIVEAU DE PORTER GARANT niveau
-> Modifier le nombre d'invitations nécessaires pour rejoindre le canal

ESPAÑOL / ENGLISH / DEUTSCH
-> Changer la langue pour l'espagnol, l'anglais ou l'allemand

AUREVOIR
-> Se désabonner du canal

DÉTRUIRE
-> Détruire définitivement ce canal et tous les enregistrements associés`,

    subscriber: `----------------------------------------------
COMMANDES
----------------------------------------------

AIDE
-> Menu des commandes

INFO
-> Afficher les stats, expliquer le fonctionnement de Signalboost

----------------------------------------------

INVITER
-> Inviter +33612345678 à s’inscrire au canal

ESPAÑOL / ENGLISH / DEUTSCH
-> Changer la langue pour l'espagnol, l'anglais ou l'allemand

SALUT
-> S'abonner au canal

AUREVOIR
-> Se désabonner du canal`,
  },

  // INFO

  info: {
    [memberTypes.ADMIN]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous êtes admin de ce canal.

nom: ${channel.name}

numéro de téléphone: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
abonné-e-s: ${getSubscriberMemberships(channel).length}
hotline: ${channel.hotlineOn ? 'activée' : 'désactivée'}
se porter garant: ${onOrOff(channel.vouchingOn)}
${channel.vouchingOn ? `niveau de porter garant: ${channel.vouchLevel}` : ''}
${channel.description ? `description: ${channel.description}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous êtes abonné-e à ce canal.

Nom: ${channel.name}
Numéro de téléphone: ${channel.phoneNumber}
Il y a ${getSubscriberMemberships(channel).length} abonné-e-s
La hotline est ${channel.hotlineOn ? 'activée' : 'désactivée'}
se porter garant: ${onOrOff(channel.vouchingOn)}
${channel.vouchingOn ? `niveau de porter garant: ${channel.vouchLevel}` : ''}
${channel.description ? `Description : ${channel.description}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous n'êtes pas abonné-e à ce canal. Envoyez SALUT pour vous abonner.

Nom: ${channel.name}
Numéro de téléphone: ${channel.phoneNumber}
Il y a ${getSubscriberMemberships(channel).length} abonné-e-s
${channel.description ? `description: ${channel.description}` : ''}

${support}`,
  },

  // INVITE

  invite: {
    notSubscriber,
    invalidPhoneNumber: input =>
      `Oups! Échec de l'envoi de l'invitation. ${invalidPhoneNumber(input)}`,
    success: `Invitation envoyée.`,
    dbError: `Oups! Échec de l'envoi de l'invitation. Veuillez réessayer. :)`,
  },

  // JOIN

  join: {
    success: channel =>
      `Bonjour! Vous êtes maintenant abonné-e au canal Signalboost [${channel.name}]. ${
        channel.description
      }

Répondez avec AIDE pour en savoir plus ou AUREVOIR pour vous désinscrire.`,
    inviteRequired: `Désolé! Les invitations sont nécessaires pour s'abonner à ce canal. Demandez à un-e ami-e de vous inviter!

Si vous avez déjà une invitation, essayez d'envoyer ACCEPTER`,
    dbError: `Oups! Une erreur s’est produite en tentant de vous ajouter au canal. Veuillez essayer de nouveau!`,
    alreadyMember: `Oups! Vous êtes déjà abonné-e à ce canal.`,
  },

  // LEAVE

  leave: {
    success: `Vous êtes maintenant désabonné-e de ce canal. Au revoir!`,
    error: `Oups! Une erreur s’est produite en tentant de vous désabonner de ce canal. Veuillez essayer de nouveau!`,
    notSubscriber,
  },

  // REMOVE

  remove: {
    success: num => `${num} supprimé-e en tant qu'admin.`,
    notAdmin,
    dbError: num =>
      `Oups! Une erreur s'est produite lors de la tentative de suppression de ${num}. Veuillez essayer de nouveau.`,
    invalidPhoneNumber,
    targetNotAdmin: num => `Oups! ${num} n’est pas un-e admin. Ielle ne peut être supprimée.`,
  },

  // RENAME

  rename: {
    success: (oldName, newName) => `[${newName}]
Canal nom changé de "${oldName}" à "${newName}”.`,
    dbError: (oldName, newName) =>
      `[${oldName}]
Oups! Une erreur s’est produite en tentant de renommer le canal de [${oldName}] à [${newName}]. Veuillez essayer de nouveau!`,
    notAdmin,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `Je vous parlerai maintenant en français!
    
Envoyez AIDE pour avoir accès au menu des commandes valides.`,
    dbError: 'Oups! Votre préférence de langue n’a pas été enregistrée. Veuillez essayer de nouveau!',
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
      success: (isOn, vouchLevel) =>
        `${
          isOn
            ? `Se porter garant activée. ${vouchLevel} ${
                vouchLevel > 1 ? 'invitations' : 'invitation'
              } seront désormais nécessaires pour rejoindre cette chaîne.

Pour inviter quelqu'un, utilisez la commande INVITER:
"INVITER +12345551234"

Pour modifier le niveau de porter garant, utilisez la commande NIVEAU DE PORTER GARANT:
"NIVEAU DE PORTER GARANT 3"`
            : `Se porter garant desactivée.`
        }`,
      notAdmin,
      dbError: isOn =>
        `Oups! Une erreur s’est produite en tentant de changer se porter garant à ${onOrOff(
          isOn,
        )}. Veuillez essayer de nouveau!`,
    },
  },

  // TRUST

  trust: {
    success: phoneNumber => `Mise à jour du numéro de sécurité de ${phoneNumber}`,
    error: phoneNumber =>
      `La mise à jour du numéro de sécurité de ${phoneNumber} a échoué. Veuillez essayer à nouveau ou contactez un-e mainteneur!`,
    invalidPhoneNumber,
    notAdmin,
    dbError: phoneNumber =>
      `Oups! Une erreur s’est produite lors de la mise à jour du numéro de sécurité de ${phoneNumber}. Veuillez essayer à nouveau!`,
  },

  // VOUCH_LEVEL

  vouchLevel: {
    success: level =>
      `Le niveau de porter garant est passé à ${level}; Des 
      ${level} ${+level > 1 ? 'invitations' : 'invitation'}
       sont désormais requises pour nouveaux abonnés rejoindre cette chaîne.`,
    invalid: parseErrors.invalidVouchLevel,
    notAdmin,
    dbError:
      'Une erreur s’est produite lors de la mise à le niveau de porter garant. Veuillez essayer à nouveau!',
  },

  // SET_DESCRIPTION

  description: {
    success: newDescription =>
      `La description du canal a été remplacée par "${newDescription}".`,
    dbError: `Oups! Une erreur s'est produite lors du changement de la description du canal. Veuillez essayer à nouveau!`,
    notAdmin,
  },
}

const notifications = {
  adminAdded: (commandIssuer, addedAdmin) =>
    `Un-e nouvel-le admin ${addedAdmin} a été ajouté e par ${commandIssuer}`,

  adminRemoved: "Un-e admin vient d'être supprimé.",

  adminLeft: 'Un-e admin vient de quitter le canal',

  channelDestroyed:
    'La chaîne et tous les enregistrements associés ont été définitivement détruits.',

  channelDestructionFailed: phoneNumber =>
    `Impossible de détruire la chaîne pour le numéro de téléphone: ${phoneNumber}`,

  channelRecycled:
    "Chaîne désactivée par manque d'utilisation. Pour créer une nouvelle chaîne, visitez https://signalboost.info",

  channelRenamed: (oldName, newName) => `Le canal a été renommé de "${oldName}" à "${newName}."`,

  setDescription: newDescription => `La description de ce canal est désormais: "${newDescription}."`,

  expiryUpdateNotAuthorized:
    "Désolé, seul-e-s les admins peuvent régler l'horloge des messages disparus.",

  hotlineMessageSent: channel =>
    `Votre message a été transmis de manière anonyme aux admins de [${channel.name}].

Envoyez AIDE pour répertorier les commandes valides. Envoyez SALUT pour vous abonner.

(Remarque: tous les messages sont transmis de manière anonyme. Indiquez votre numéro de téléphone si vous souhaitez que les admins vous répondent individuellement.)`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Désolé, la hotline n’est pas activé sur ce canal. Envoyez AIDE pour répertorier les commandes valides.'
      : 'Désolé, la hotline n’est pas activé sur ce canal. Envoyez AIDE pour lister les commandes valides ou SALUT pour vous abonner.',

  inviteReceived: (channelName, invitesReceived, invitesNeeded) =>
    `Bonjour! Vous avez reçu les invitations ${invitesReceived}/${invitesNeeded} nécessaires pour rejoindre la chaîne Signalboost de ${channelName}.
       ${invitesReceived === invitesNeeded ? `Veuillez répondre avec ACCEPTER ou REFUSER.` : ''}
     `,

  inviteAccepted: `Félicitations! Quelqu'un a accepté votre invitation et est maintenant abonné à cette chaîne.`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} a été retiré de ce canal parce que leur numéro de sécurité a été modifié.

C'est probablement parce que Signal a été installé sur un nouvel appareil.

Cependant, il y a un petit risque que leur téléphone soit compromis et qu'une autre personne tente de se faire passer pour elleux.

Vérifiez auprès de ${adminPhoneNumber} pour vous assurer qu’ielles contrôlent toujours leur appareil, et vous pouvez par la suite les revalider avec:

AJOUTER ${adminPhoneNumber}

Ielles seront incapables d’envoyer ou de lire des messages sur ce canal avant que cette étape soit complétée.`,
  noop: 'Oups! Ceci n’est pas une commande!',
  unauthorized:
    'Oups! La hotline est désactivée. Pour le moment, ce canal acceptera uniquement des commandes. Commande AIDE pour voir le menu de commandes valides!',

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Demande d’abonnement reçu provenant de ${senderNumber}:
${requestMsg}`,

  signupRequestResponse:
    'Merci pour votre abonnement avec Signalboost! Vous recevrez bientôt un message d’accueil sur votre nouveau canal...',

  toRemovedAdmin:
    "Vous venez d'être supprimé e en tant qu'admin de cette chaîne. Envoyez SALUT pour vous réinscrire.",

  toggles: commandResponses.toggles,

  rateLimitOccurred: (channelPhoneNumber, resendInterval) =>
    `Erreur de limite de débit sur le canal: ${channelPhoneNumber}.
${
  resendInterval
    ? `tentative sera faite pour renvoyer le message en: ${resendInterval.toString().slice(0, -3)}s`
    : `le message a dépassé le seuil de renvoi et ne sera pas renvoyé`
}`,

  recycleChannelFailed: phoneNumber =>
    `Échec du recyclage de la chaîne pour le numéro de téléphone: ${phoneNumber}`,

  vouchLevelChanged: vouchLevel =>
    `Un-e admin vient de changer le niveau du garant en ${vouchLevel}; ${vouchLevel} ${
      vouchLevel > 1 ? 'invitations' : 'invitation'
    } seront désormais nécessaires pour rejoindre cette chaîne.`,

  welcome: (addingAdmin, channelPhoneNumber) =>
    `Vous êtes maintenant un.e
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
  parseErrors,
  prefixes,
  systemName,
}
