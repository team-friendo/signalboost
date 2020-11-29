const { upperCase } = require('lodash')
const { memberTypes } = require('../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../db/repositories/channel')
const {
  signal: { maxVouchLevel },
} = require('../../../config')

const systemName = "l'admin système de signalboost"
const notAdmin =
  'Désolé, seul-e-s les admins sont autorisé-e-s à exécuter cette commande. Envoyez AIDE pour une liste de commandes valides.'
const notSubscriber =
  "Votre commande n'a pas pu être traitée car vous n'êtes pas abonné-e à ce canal. Envoyez BONJOUR pour vous abonner."
const subscriberLimitReached = subscriberLimit =>
  `Désolé, cette canal a atteint sa limite de ${subscriberLimit} abonnés.`
const requestsClosed = `Désolé, Signalboost n'accepte pas de nouvelles demandes de chaînes pour le moment! Veuillez vérifier à nouveau plus tard.`
const onOrOff = isOn => (isOn ? 'activé' : 'désactivé')

const vouchModeDisplay = {
  ON: 'activée',
  ADMIN: 'admin',
  OFF: 'désactivée',
}

const support = `----------------------------------------------
COMMENT ÇA FONCTIONNE
----------------------------------------------

Signalboost dispose de canaux avec des admins et des abonné-e-s :

-> Lorsque les admins envoient des messages, ils sont transmis à tou-te-s les abonné-e-s.
-> Si l’option Hotline est activé, les abonné-e-s peuvent envoyer des messages anonymes aux admins du canal.

Signalboost protège votre vie privée :

-> Les utilisateurices ne peuvent pas voir les numéros de téléphone des autres usagèr-e-s.
-> Signalboost ne lit pas et ne conserve aucun de vos messages.

Signalboost répond aux commandes:

-> AIDE affiche le menu des commandes.

Pour plus de renseignements: https://signalboost.info`

const validPhoneNumberHint = `Les numéros de téléphone doivent comprendre l’indicatifs téléphonique du pays précédé par un «+».`

const parseErrors = {
  missingCommand:
    'Vouliez-vous préfixer votre message avec DIFFUSER? Envoyez AIDE pour voir une liste de toutes les commandes.',

  unnecessaryPayload: command =>
    `Désolé, la commande n'a pas été reconnue.
 
 Vouliez-vous utiliser ${upperCase(command)} ou DIFFUSER?
    
 Envoyez une aide pour obtenir une liste de toutes les commandes valides et comment les utiliser.`,

  invalidPhoneNumber: phoneNumber =>
    `"${phoneNumber}" n’est pas un numéro de téléphone valide. ${validPhoneNumberHint}`,

  invalidPhoneNumbers: phoneNumbers =>
    `"${phoneNumbers.join(
      ', ',
    )}" ce ne sont pas des numéros de téléphone valides. ${validPhoneNumberHint}`,

  invalidVouchLevel: invalidVouchLevel =>
    `"${invalidVouchLevel} n'est pas un niveau de porter garant valide. Veuillez utiliser un nombre compris entre 1 et ${maxVouchLevel}.`,

  invalidHotlineMessageId: payload =>
    `Avez-vous essayé de répondre à un message de la hotline? Désolé, ${payload} n'est pas un identifiant de hotline valide. Un identifiant de hotline valide ressemble à: @123`,
}

const invalidPhoneNumber = parseErrors.invalidPhoneNumber

const commandResponses = {
  // ACCEPT

  accept: {
    success: `Bonjour! Vous êtes maintenant abonné e au cette canal Signalboost.

Répondez avec AIDE pour en savoir plus ou ADIEU pour vous désinscrire.`,
    alreadyMember: 'Désolé, vous êtes déjà membre de ce canal',
    belowVouchLevel: (required, actual) =>
      `Désolé, cette canal nécessite ${required} invitation(s) pour rejoindre. Vous avez ${actual}.`,
    dbError:
      "Oups! Une erreur s'est produite lors de l'acceptation de votre invitation. Veuillez réessayer!",
    subscriberLimitReached,
  },

  // ADD

  add: {
    success: newAdmin =>
      `${newAdmin.memberPhoneNumber} a été ajouté e comme ADMIN ${newAdmin.adminId}.`,
    notAdmin,
    dbError: num =>
      `Oups! Une erreur s’est produite en tentant de supprimer ${num}. Veuillez essayer de nouveau.`,
    invalidPhoneNumber,
  },

  // BAN
  ban: {
    success: messageId => `L'expéditeur du message de la hotline ${messageId} a été banni.`,
    notAdmin,
    doesNotExist: "L'expéditeur de ce message de la hotline est inactif, nous ne stockons donc plus leurs enregistrements de messages. Veuillez réessayer une fois qu'ils ont de nouveau message",
    alreadyBanned: messageId =>
      `L'expéditeur du message de la hotline ${messageId} est déjà banni.`,
    dbError: "Oups! Échec de l'émission de l'interdiction. Veuillez réessayer!",
    invalidHotlineMessageId: messageId =>
      `Désolé, l'ID de message de la hotline @${messageId} a expiré ou n'a jamais existé.`,
    toBannedSubscriber:
      'Un administrateur de cette chaîne vous a banni. Aucune autre interaction ne sera reçue par les administrateurs de la chaîne.',
  },

  // BROADCAST
  broadcast: {
    notAdmin,
  },

  // CHANNEL
  channel: {
    success: phoneNumber => `Votre chaîne Signalboost a été créée! Dans un instant, vous devriez recevoir un message de bienvenue de votre numéro de téléphone de chaîne:
${phoneNumber}.

Si vous avez des questions ou rencontrez des problèmes pour accéder à votre chaîne, vous pouvez envoyer un message à l'assistance Signalboost ici.
`,
    requestsClosed: requestsClosed,
    error: `Désolé, une erreur s'est produite lors du traitement de votre demande de chaîne! Veuillez réessayer plus tard. Si votre problème persiste, vous pouvez envoyer un message à l'assistance Signalboost ici.`,
  },

  // DECLINE

  decline: {
    success: `Invitation refusée. Toutes les informations sur l'invitation ont été supprimées.`,
    dbError: `Oups! Une erreur s'est produite lors du refus de l'invitation. Veuillez réessayer!`,
  },

  destroy: {
    confirm: `Êtes-vous sûr?

Si vous continuez, vous détruirez définitivement cette canal et tous les enregistrements qui lui sont associés.

Pour continuer, répondez avec:

 CONFIRMER DÉTRUIRE`,
    success: `La canal et tous les enregistrements associés ont été définitivement détruits.`,
    error: `Oups! Une erreur s'est produite lors de la destruction de la canal. Veuillez réessayer!`,
    notAdmin,
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

DIFFUSER bonjour à tous / ! bonjour à tous
-> diffuse "bonjour à tous" à tous les abonnés de cette canal

@1312
-> Envoie une réponse privée à [HOTLINE @1312]

INVITE +33612345678, +336187654321
-> Inviter +33612345678 et +336187654321 à s’inscrire au canal

AJOUTER +33612345678
-> Ajouter +33612345678 en tant qu'admin du canal

PRIVÉ bonjour admins / ~ bonjour admins
-> envoie un message privé "bonjour admins" à tous les administrateurs de la canal

ESPAÑOL / ENGLISH / DEUTSCH
-> Changer la langue pour l'espagnol, l'anglais ou l'allemand

HOTLINE ON / OFF
-> Activer ou désactiver la hotline

SE PORTER GARANT ON / OFF / ADMIN
-> active / désactive l'activation de se porter garant. Lorsque cette option est ON, les personnes doivent être invitées à rejoindre la canal. Lorsque ADMIN, seuls les administrateurs peuvent envoyer ces invitations.

NIVEAU DE PORTER GARANT niveau
-> Modifier le nombre d'invitations nécessaires pour rejoindre le canal

SUPPRIMER +33612345678
-> Supprimer +33612345678 del canal

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

INVITE +33612345678, +336187654321
-> Inviter +33612345678 et +336187654321 à s’inscrire au canal

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


numéro de téléphone: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
abonné-e-s: ${getSubscriberMemberships(channel).length}
limite d'abonné-e-s:${channel.subscriberLimit}
hotline: ${channel.hotlineOn ? 'activée' : 'désactivée'}
se porter garant: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `niveau de porter garant: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous êtes abonné-e à ce canal.

Numéro de téléphone: ${channel.phoneNumber}
La hotline est ${channel.hotlineOn ? 'activée' : 'désactivée'}
se porter garant: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `niveau de porter garant: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
INFOS CANAL
---------------------------

Vous n'êtes pas abonné-e à ce canal. Envoyez SALUT pour vous abonner.

Numéro de téléphone: ${channel.phoneNumber}
Il y a ${getSubscriberMemberships(channel).length} abonné-e-s

${support}`,
  },

  // INVITE

  invite: {
    notSubscriber,
    invalidPhoneNumber: input =>
      `Oups! Échec de l'envoi de l'invitation. ${invalidPhoneNumber(input)}`,
    success: n => (n === 1 ? `Invitation envoyée.` : `${n} invitations ont été envoyées.`),
    adminOnly: 'Désolé, seuls les administrateurs peuvent inviter des personnes à cette canal.',
    dbError: `Oups! Échec de l'envoi de l'invitation. Veuillez réessayer. :)`,

    dbErrors: (failedPhoneNumbers, allPhoneNumbers) =>
      `Oups! Échec de l'envoi des invitations pour ${
        failedPhoneNumbers.length
      } numéros de téléphone sur ${allPhoneNumbers.length}.

Veuillez réessayer d'émettre INVITER pour les numéros suivants:

${failedPhoneNumbers.join(',')}`,

    subscriberLimitReached: (numInvitees, subscriberLimit, subscriberCount) =>
      `Vous essayez d'inviter ${numInvitees} nouveaux abonnés? Désolé, cette canal est limitée à ${subscriberLimit} abonnés et compte déjà ${subscriberCount} abonnés.`,
  },

  // JOIN

  join: {
    success: `Bonjour! Vous êtes maintenant abonné-e au cette canal Signalboost.

Répondez avec AIDE pour en savoir plus ou AUREVOIR pour vous désinscrire.`,
    inviteRequired: `Désolé! Les invitations sont nécessaires pour s'abonner à ce canal. Demandez à un-e ami-e de vous inviter!

Si vous avez déjà une invitation, essayez d'envoyer ACCEPTER`,
    dbError: `Oups! Une erreur s’est produite en tentant de vous ajouter au canal. Veuillez essayer de nouveau!`,
    alreadyMember: `Oups! Vous êtes déjà abonné-e à ce canal.`,
    subscriberLimitReached,
  },

  // LEAVE

  leave: {
    success: `Vous êtes maintenant désabonné-e de ce canal. Au revoir!`,
    error: `Oups! Une erreur s’est produite en tentant de vous désabonner de ce canal. Veuillez essayer de nouveau!`,
    notSubscriber,
  },

  // PRIVATE

  private: {
    notAdmin,
    signalError: `Oups! Une erreur s'est produite lors de l'envoi d'un message privé aux administrateurs de cette canal. Veuillez essayer de nouveau!`,
  },

  // REMOVE

  remove: {
    success: num => `${num} a été supprimé-e.`,
    notAdmin,
    targetNotMember: num => `Oups! ${num} n'est pas membre de cette canal`,
    dbError: num =>
      `Oups! Une erreur s'est produite lors de la tentative de suppression de ${num}. Veuillez essayer de nouveau.`,
    invalidPhoneNumber,
  },

  // REPLY

  hotlineReply: {
    success: hotlineReply => notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
    notAdmin,
    invalidMessageId: messageId =>
      `Désolé, l'identifiant de message de la hotline @${messageId} a expiré ou n'a jamais existé.`,
  },

  // REQUEST
  request: {
    success: `Salut! Voulez-vous créer un canal Signalboost?

Signalboost est une technologie qui vous permet d'envoyer des émissions et de recevoir des messages d'assistance téléphonique sans révéler votre numéro de téléphone aux destinataires.

L'utilisation de cet outil signifie que vous nous faites confiance pour être de bons gestionnaires des numéros de téléphone de tous ceux qui utilisent votre chaîne:
https://signalboost.info/privacy

Maintenant, si vous souhaitez créer une chaîne, envoyez CHANNEL suivi d'une liste de numéros de téléphone administrateur séparés par des virgules (y compris le code du pays), par exemple:

CANAL +1555123412, +1555123419`,
    closed: requestsClosed,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `Je vous parlerai maintenant en français!
    
Envoyez AIDE pour avoir accès au menu des commandes valides.`,
    dbError:
      'Oups! Votre préférence de langue n’a pas été enregistrée. Veuillez essayer de nouveau!',
  },

  // TOGGLES (HOTLINE)

  toggles: {
    hotline: {
      success: isOn => `La hotline a été ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `Oups! Une erreur s’est produite en tentant de changer la hotline à ${onOrOff(
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

  // VOUCHING
  vouchMode: {
    success: (mode, adminId) => {
      const vouchingStatus = adminId
        ? `ADMIN ${adminId} a configuré se porter garant ${vouchModeDisplay[mode]}.`
        : `Se porter garant ${vouchModeDisplay[mode]}.`

      const explanation = {
        ON: `Cela signifie qu'une invitation d'un membre existant est requise pour rejoindre cette canal.
Tout le monde peut envoyer une invitation en envoyant INVITER + 1-555-123-1234.

Les administrateurs peuvent ajuster le nombre d'invitatnions nécessaires pour se joindre à l'aide de la commande NIVEAU DE PORTER GARANT.`,
        OFF: `Cela signifie que n'importe qui peut rejoindre la canal en envoyant BONJOUR au numéro de canal.`,
        ADMIN: `Cela signifie qu'une invitation d'un * administrateur * est requise pour rejoindre cette canal.
Tout le monde peut envoyer une invitation en envoyant INVITER + 1-555-123-1234.

Les administrateurs peuvent ajuster le nombre d'invitations nécessaires pour se joindre à l'aide de la commande NIVEAU DE PORTER GARANT.`,
      }[mode]

      return `${vouchingStatus}

${explanation}`
    },
    notAdmin,
    dbError:
      "Une erreur s'est produite lors de la mise à jour de l'attestation de votre canal. Veuillez réessayer.",
  },

  // VOUCH_LEVEL

  vouchLevel: {
    success: level =>
      `Le niveau de porter garant est passé à ${level}; Des 
      ${level} ${+level > 1 ? 'invitations' : 'invitation'}
       sont désormais requises pour nouveaux abonnés rejoindre cette canal.`,
    invalid: parseErrors.invalidVouchLevel,
    notAdmin,
    dbError:
      'Une erreur s’est produite lors de la mise à le niveau de porter garant. Veuillez essayer à nouveau!',
  },

  // NONE
  none: {
    error:
      'Vouliez-vous préfixer votre message avec DIFFUSER? Envoyez AIDE pour voir une liste de toutes les commandes.',
  },
}

const notifications = {
  adminAdded: (adderAdminId, addedAdminId) =>
    `ADMIN ${adderAdminId} a ajouté ADMIN ${addedAdminId}.`,

  adminRemoved: (removerAdminId, removedAdminId) =>
    `ADMIN ${removerAdminId} enlevé ADMIN ${removedAdminId}`,

  subscriberRemoved: adminId => `ADMIN ${adminId} a supprimé un abonné.`,

  adminLeft: adminId => `ADMIN ${adminId} vient de quitter le canal.`,

  channelDestroyedByAdmin: (adminId, audience) =>
    ({
      ADMIN: `ADMIN ${adminId} a détruit ce canal. Toutes les données associées ont été supprimées.`,
      SUBSCRIBER:
        'La chaîne et toutes les données associées ont été définitivement détruites par les administrateurs de cette chaîne.',
    }[audience]),

  channelDestructionScheduled: hoursToLive =>
    `Salut! Cette canal sera détruite dans ${hoursToLive} heures en raison d'un manque d'utilisation.

Pour éviter qu'il ne soit détruit, envoyez INFO dans les prochaines ${hoursToLive} heures.

Si vous souhaitez détruire le canal maintenant, répondez avec DÉTRUIRE.

Pour plus d'informations, visitez signalboost.info/how-to.`,

  channelDestructionFailed: (phoneNumber, error) =>
    `Impossible de détruire la canal pour le numéro de téléphone: ${phoneNumber}.
  ERROR: ${error}`,

  channelDestroyedBySystem:
    "Canal détruit par manque d'utilisation. Pour créer une nouvelle canal, visitez https://signalboost.info",

  channelRedeemed:
    "Cette canal devait être détruite en raison d'un manque d'utilisation. Cependant, puisque vous avez utilisé la canal récemment, elle ne sera plus détruite. Yay!",

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} a été retiré de ce canal parce que leur numéro de sécurité a été modifié.

C'est probablement parce que Signal a été installé sur un nouvel appareil.

Cependant, il y a un petit risque que leur téléphone soit compromis et qu'une autre personne tente de se faire passer pour elleux.

Vérifiez auprès de ${adminPhoneNumber} pour vous assurer qu’ielles contrôlent toujours leur appareil, et vous pouvez par la suite les revalider avec:

AJOUTER ${adminPhoneNumber}

Ielles seront incapables d’envoyer ou de lire des messages sur ce canal avant que cette étape soit complétée.`,

  expiryUpdateNotAuthorized:
    "Désolé, seul-e-s les admins peuvent régler l'horloge des messages disparus.",

  hotlineMessageSent: `Votre message a été transmis de manière anonyme aux admins de cette canal Signalboost.

Envoyez AIDE pour répertorier les commandes valides. Envoyez SALUT pour vous abonner.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Désolé, la hotline n’est pas activé sur ce canal. Envoyez AIDE pour répertorier les commandes valides.'
      : 'Désolé, la hotline n’est pas activé sur ce canal. Envoyez AIDE pour lister les commandes valides ou SALUT pour vous abonner.',

  hotlineReplyOf: ({ messageId, reply }, memberType) => {
    const prefix =
      memberType === memberTypes.ADMIN ? prefixes.hotlineReplyTo(messageId) : prefixes.hotlineReply
    return `[${prefix}]\n${reply}`
  },

  inviteReceived: `Bonjour! Vous avez reçu le invitation a rejoindre cette canal Signalboost. Veuillez répondre avec ACCEPTER ou REFUSER.`,

  invitedToSupportChannel: `Bonjour! Il s'agit du canal de support Signalboost.
  
Les responsables de Signalboost l'utilisent pour envoyer des annonces occasionnelles sur les nouvelles fonctionnalités et répondre à toutes vos questions.

Veuillez répondre par ACCEPTER pour vous abonner ou REFUSER de ne pas vous abonner.`,

  inviteAccepted: `Félicitations! Quelqu'un a accepté votre invitation et est maintenant abonné à cette canal.`,

  promptToUseSignal:
    'Ce numéro accepte uniquement les messages envoyés avec Signal Private Messenger. Veuillez installer Signal depuis https://signal.org et réessayer.',

  noop: 'Oups! Ceci n’est pas une commande!',

  rateLimitOccurred: (channelPhoneNumber, resendInterval) =>
    `Erreur de limite de débit sur le canal: ${channelPhoneNumber}.
  ${
    resendInterval
      ? `tentative sera faite pour renvoyer le message en: ${resendInterval
          .toString()
          .slice(0, -3)}s`
      : `le message a dépassé le seuil de renvoi et ne sera pas renvoyé`
  }`,

  destroyChannelFailed: phoneNumber =>
    `Échec de la destruction du canal pour le numéro de téléphone: ${phoneNumber}`,

  channelCreationResult: (success, numAvailablePhoneNumbers, numChannels) =>
    `${success ? `Nouvelle chaîne créée.` : `La création du canal a échoué.`}
- ${numChannels} canaux actifs
- ${numAvailablePhoneNumbers} numéros de téléphone disponibles`,

  channelCreationError: err => `Erreur lors de la création de la chaîne: ${err}`,

  restartRequesterNotAuthorized:
    "Vous essayez de redémarrer Signalboost? Vous n'êtes pas autorisé à faire ça!",
  restartChannelNotAuthorized:
    'Vous essayez de redémarrer Signalboost? Vous utilisez le mauvais canal pour cela! Réessayez sur le canal de diagnostic.',
  restartPassNotAuthorized:
    'Vous essayez de redémarrer Signalboost? Vous avez utilisé la mauvaise phrase de passe pour cela!',
  restartSuccessNotification: adminId => `ADMIN ${adminId} redémarré Signalboost.`,
  restartSuccessResponse: 'Signalboost a été redémarré avec succès',
  restartFailure: errorMessage => `Échec du redémarrage de Signalboost: ${errorMessage}`,

  safetyNumberChanged:
    'Il semble que votre numéro de sécurité vient de changer. Vous devrez peut-être renvoyer votre dernier message! :)',

  toRemovedAdmin: adminId =>
    `Vous venez d'être supprimé e en tant qu'admin de cette canal par ADMIN ${adminId}. Envoyez SALUT pour vous réinscrire.`,

  toRemovedSubscriber:
    "Vous venez d'être supprimé de cette canal par un administrateur. Envoyez SALUT pour vous réinscrire.",

  hotlineToggled: (isOn, adminId) => `ADMIN ${adminId} a ${onOrOff(isOn)} la hotline.`,

  unauthorized:
    'Oups! La hotline est désactivée. Pour le moment, ce canal acceptera uniquement des commandes. Commande AIDE pour voir le menu de commandes valides!',

  vouchedInviteReceived: (invitesReceived, invitesNeeded) =>
    `Bonjour! Vous avez reçu les invitations ${invitesReceived}/${invitesNeeded} nécessaires pour rejoindre la cette canal Signalboost.
  ${invitesReceived === invitesNeeded ? `Veuillez répondre avec ACCEPTER ou REFUSER.` : ''}
  `,

  vouchModeChanged: commandResponses.vouchMode.success,

  vouchLevelChanged: (adminId, vouchLevel) =>
    `ADMIN ${adminId} a changé le niveau du garant en ${vouchLevel}; ${vouchLevel} ${
      vouchLevel > 1 ? 'invitations' : 'invitation'
    } seront désormais nécessaires pour rejoindre cette canal.`,

  welcome: (addingAdmin, channelPhoneNumber) =>
    `Bienvenue! Vous venez d'être nommé administrateur de cette chaîne Signalboost par ${addingAdmin}.

1. Ajoutez ce numéro de téléphone(${channelPhoneNumber}) à vos contacts.
2. Envoyez une aide pour voir quelles commandes vous pouvez utiliser.
3. Envoyez INFO pour voir combien d'administrateurs et d'abonnés sont sur ce canal.
4. Consultez les ressources suivantes:
- https://signalboost.info/how-to
- https://www.instagram.com/_signalboost/
- https://signalboost.info/privacy/

psIl nous en coûte ~3$/mois pour faire fonctionner chaque canal.Depuis que nous fabriquons ce logiciel pour la libération, sans but lucratif, nous comptons sur le soutien matériel de notre communauté pour maintenir le projet à flot.Si vous pouvez vous le permettre, veuillez envisager de faire un don ici: https://signalboost.info/donate 💸`,
}

const prefixes = {
  broadcastMessage: `DIFFUSER`,
  fromAdmin: 'DE ADMIN',
  hotlineMessage: messageId => `HOTLINE DE @${messageId}`,
  hotlineReply: `RÉPONSE PRIVÉE DES ADMINS`,
  hotlineReplyTo: messageId => `RÉPONSE Á @${messageId}`,
  notificationHeader: `NOTIFICATION`,
  privateMessage: `PRIVÉ`,
}

module.exports = {
  commandResponses,
  notifications,
  parseErrors,
  prefixes,
  systemName,
}
