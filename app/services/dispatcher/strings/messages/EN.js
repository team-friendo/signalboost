const { memberTypes } = require('../../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')
const {
  signal: { maxVouchLevel },
} = require('../../../../config')

const systemName = 'the signalboost system administrator'
const notAdmin =
  'Sorry, only admins are allowed to issue that command. Send HELP for a list of valid commands.'
const notSubscriber =
  'Your command could not be processed because you are not subscribed to this channel. Send HELLO to subscribe.'

const onOrOff = isOn => (isOn ? 'on' : 'off')

const support = `----------------------------
HOW IT WORKS
----------------------------

Signalboost has channels with admins and subscribers:

-> When admins send announcements, they are broadcast to all subscribers.
-> If hotline mode is enabled, anyone can send anonymous messages to the admins.

Signalboost protects your privacy:

-> Users cannot see other users' phone numbers. (Cops can't either!)
-> Signalboost does not read or store the contents of anyone's messages.

Signalboost responds to commands:

-> Send HELP to list them.

Learn more: https://signalboost.info`

const validPhoneNumberHint = `Phone numbers must include country codes prefixed by a '+'.`

const parseErrors = {
  invalidPhoneNumber: phoneNumber =>
    `"${phoneNumber}" is not a valid phone number. ${validPhoneNumberHint}`,

  invalidPhoneNumbers: phoneNumbers =>
    `"${phoneNumbers.join(', ')}" are not valid phone numbers. ${validPhoneNumberHint}`,

  invalidVouchLevel: vouchLevel =>
    `"${vouchLevel}" is not a valid vouch level. Please use a number between 1 and ${maxVouchLevel}.`,

  invalidHotlineMessageId: payload =>
    `${payload} does not contain a valid hotline message number. A valid hotline message number looks like: #123`,
}

const invalidPhoneNumber = parseErrors.invalidPhoneNumber

const commandResponses = {
  // ACCEPT

  accept: {
    success: channel => `Hi! You are now subscribed to the [${channel.name}] Signalboost channel. ${
      channel.description
    }

Reply with HELP to learn more or GOODBYE to unsubscribe.`,
    alreadyMember: 'Sorry, you are already a member of this channel',
    belowVouchLevel: (channel, required, actual) =>
      `Sorry, ${channel.name} requires ${required} invite(s) to join. You have ${actual}.`,
    dbError: 'Whoops! There was an error accepting your invite. Please try again!',
  },

  // ADD

  add: {
    success: num => `${num} added as an admin.`,
    notAdmin,
    dbError: num => `Whoops! There was an error adding ${num} as an admin. Please try again!`,
    invalidPhoneNumber,
  },

  // DECLINE

  decline: {
    success: 'Invitation declined. All information about invitation deleted.',
    dbError: 'Whoops! There was an error declining the invite. Please try again!',
  },

  destroy: {
    confirm: `Are you sure?

If you continue, you will permanently destroy this channel and all records associated with it.

To continue, respond with:

CONFIRM DESTROY`,
    success: 'Channel and all associated records have been permanently destroyed.',
    notAdmin,
    error: 'Oops! There was an error destroying the channel. Please try again!',
  },

  // HELP

  help: {
    admin: `----------------------------------------------
COMMANDS
----------------------------------------------

HELP
-> lists commands

INFO
-> shows stats, explains how Signalboost works

----------------------------------------------

RENAME new name
-> renames channel to "new name"

DESCRIPTION description of channel
-> adds or updates public description of channel

INVITE +1-555-555-5555, +1-444-444-4444
-> invites +1-555-555-5555 and +1-444-444-4444 to subscribe to the channel

ADD +1-555-555-5555
-> adds +1-555-555-5555 as an admin of the channel

REMOVE +1-555-555-5555
-> removes +1-555-555-5555 from the channel

HOTLINE ON / OFF
-> enables or disables hotline

REPLY #1312
-> sends private reply to [HOTLINE #1312]

PRIVATE good evening admins
-> sends private message "good evening admins" to all admins of the channel

VOUCHING ON / OFF
-> enables or disables requirement to receive an invite to subscribe

VOUCH LEVEL level
-> changes the number of invites needed to join the channel

ESPAÑOL / FRANÇAIS / DEUTSCH
-> switches language to Spanish, French or German

GOODBYE
-> leaves this channel

DESTROY
-> permanently destroys this channel and all associated records`,

    subscriber: `----------------------------------------------
COMMANDS
----------------------------------------------

HELP
-> lists commands

INFO
-> shows stats, explains how Signalboost works

----------------------------------------------

INVITE +1-555-555-5555, +1-444-444-4444
-> invites +1-555-555-5555 and +1-444-444-4444 to subscribe to the channel

ESPAÑOL / FRANÇAIS / DEUTSCH
-> switches language to Spanish, French or German

HELLO
-> subscribes you to announcements

GOODBYE
-> unsubscribes you from announcements`,
  },

  // INFO

  info: {
    [memberTypes.ADMIN]: channel => `---------------------------
CHANNEL INFO
---------------------------

You are an admin of this channel.

name: ${channel.name}

phone number: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
subscribers: ${getSubscriberMemberships(channel).length}
hotline: ${onOrOff(channel.hotlineOn)}
vouching: ${onOrOff(channel.vouchingOn)}
${channel.vouchingOn ? `vouch level: ${channel.vouchLevel}` : ''}
${channel.description ? `description: ${channel.description}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
CHANNEL INFO
---------------------------

You are subscribed to this channel.

name: ${channel.name}
phone number: ${channel.phoneNumber}
subscribers: ${getSubscriberMemberships(channel).length}
hotline: ${onOrOff(channel.hotlineOn)}
vouching: ${onOrOff(channel.vouchingOn)}
${channel.vouchingOn ? `vouch level: ${channel.vouchLevel}` : ''}
${channel.description ? `description: ${channel.description}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
CHANNEL INFO
---------------------------

You are not subscribed to this channel. Send HELLO to subscribe.

name: ${channel.name}
phone number: ${channel.phoneNumber}
subscribers: ${getSubscriberMemberships(channel).length}
${channel.description ? `description: ${channel.description}` : ''}

${support}`,
  },

  // INVITE

  invite: {
    notSubscriber,
    invalidPhoneNumber: input => `Whoops! Failed to issue invitation. ${invalidPhoneNumber(input)}`,
    success: n => (n === 1 ? `Invite issued.` : `${n} invites issued.`),
    dbError: 'Oops! Failed to issue invitation. Please try again. :)',
    dbErrors: (failedPhoneNumbers, inviteCount) => `Oops! Failed to issue invitations for ${
      failedPhoneNumbers.length
    } out of ${inviteCount} phone numbers.

Please trying issuing INVITE again for the following numbers:

${failedPhoneNumbers.join(',')}`,
  },

  // JOIN

  join: {
    success: channel => `Hi! You are now subscribed to the [${channel.name}] Signalboost channel. ${
      channel.description
    }

Reply with HELP to learn more or GOODBYE to unsubscribe.`,
    inviteRequired: `Sorry! Invites are required to subscribe to this channel. Ask a friend to invite you!

If you already have an invite, try sending ACCEPT`,
    dbError: `Whoops! There was an error adding you to the channel. Please try again!`,
    alreadyMember: `Whoops! You are already a member of this channel.`,
  },

  // LEAVE

  leave: {
    success: `You've been removed from the channel! Bye!`,
    error: `Whoops! There was an error removing you from the channel. Please try again!`,
    notSubscriber,
  },

  // PRIVATE

  private: {
    notAdmin,
    signalError: `Whoops! There was an error trying to private message the admins of this channel. Please try again!`,
  },

  // REMOVE

  remove: {
    success: num => `${num} was removed.`,
    notAdmin,
    targetNotMember: num => `Ooops! ${num} is not a member of this channel!`,
    dbError: num => `Whoops! There was an error trying to remove ${num}. Please try again!`,
    invalidPhoneNumber,
  },

  // RENAME

  rename: {
    success: (oldName, newName) =>
      `[${newName}]
Channel renamed from "${oldName}" to "${newName}".`,
    dbError: (oldName, newName) =>
      `[${oldName}]
Whoops! There was an error renaming the channel [${oldName}] to [${newName}]. Try again!`,
    notAdmin,
  },

  // REPLY

  hotlineReply: {
    success: hotlineReply => notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
    notAdmin,
    invalidMessageId: messageId =>
      `Sorry, the hotline message identifier #${messageId} has expired or never existed.`,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `I will talk to you in English now! 
    
Send HELP to list commands I understand.`,
    dbError: 'Whoops! Failed to store your language preference. Please try again!',
  },

  // TOGGLES (HOTLINE, VOUCHING)

  toggles: {
    hotline: {
      success: isOn => `Hotline turned ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `Whoops! There was an error trying to turn the hotline ${onOrOff(isOn)}. Please try again!`,
    },
    vouching: {
      success: (isOn, vouchLevel) =>
        `${
          isOn
            ? `Vouching turned on. Joining this channel will now require ${vouchLevel} ${
                vouchLevel > 1 ? 'invites' : 'invite'
              }.

To vouch for someone, use the INVITE command. For example:
"INVITE +12345551234"

To change the vouching level, use the VOUCH LEVEL command. For example:
"VOUCH LEVEL 3"`
            : `Vouching turned off.`
        }`,
      notAdmin,
      dbError: isOn =>
        `Whoops! There was an error trying to turn vouching ${onOrOff(isOn)}. Please try again!`,
    },
  },

  // TRUST

  trust: {
    success: phoneNumber => `Updated safety number for ${phoneNumber}`,
    error: phoneNumber =>
      `Failed to update safety number for ${phoneNumber}. Try again or contact a maintainer!`,
    invalidPhoneNumber,
    notAdmin,
    dbError: phoneNumber =>
      `Whoops! There was an error updating the safety number for ${phoneNumber}. Please try again!`,
  },

  // VOUCH_LEVEL
  vouchLevel: {
    success: level =>
      `Vouching level set to ${level}. It will now take ${level} ${
        level > 1 ? 'invites' : 'invite'
      } for new subscribers to join this channel.`,
    invalid: parseErrors.invalidVouchLevel,
    notAdmin,
    dbError: 'There was an error updating the vouching level. Please try again.',
  },

  // SET_DESCRIPTION

  description: {
    success: newDescription => `Channel description changed to "${newDescription}".`,
    dbError: `Whoops! There was an error changing the channel description. Try again!`,
    notAdmin,
  },
}

const notifications = {
  adminAdded: 'A new admin was just added.',

  adminRemoved: 'An admin was just removed.',

  subscriberRemoved: 'An subscriber was just removed.',

  adminLeft: 'An admin just left the channel.',

  channelDestroyed: 'Channel and all associated records have been permanently destroyed.',

  channelDestructionFailed: phoneNumber =>
    `Failed to destroy channel for phone number: ${phoneNumber}`,

  channelRecycled:
    'Channel deactivated due to lack of use. To create a new channel, visit https://signalboost.info',

  channelRenamed: (oldName, newName) => `Channel renamed from "${oldName}" to "${newName}."`,

  setDescription: newDescription => `Channel description set to "${newDescription}."`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} has been removed from this channel because their safety number changed.

This is almost certainly because they reinstalled Signal on a new phone.

However, there is a small chance that an attacker has compromised their phone and is trying to impersonate them.

Check with ${adminPhoneNumber} to make sure they still control their phone, then reauthorize them with:

ADD ${adminPhoneNumber}

Until then, they will be unable to send messages to or read messages from this channel.`,

  expiryUpdateNotAuthorized: 'Sorry, only admins can set the disappearing message timer.',

  hotlineMessageSent: channel =>
    `Your message was forwarded to the admins of [${channel.name}].

Send HELP to list valid commands. Send HELLO to subscribe.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Sorry, this channel does not have a hotline enabled. Send HELP to list valid commands.'
      : 'Sorry, this channel does not have a hotline enabled. Send HELP to list valid commands or HELLO to subscribe.',

  hotlineReplyOf: ({ messageId, reply }, memberType) =>
    `[${prefixes.hotlineReplyOf(messageId, memberType)}]\n${reply}`,

  inviteReceived: channelName =>
    `Hello! You have received an invite to join the [${channelName}] Signalboost channel. Please respond with ACCEPT or DECLINE.`,

  vouchedInviteReceived: (channelName, invitesReceived, invitesNeeded) =>
    `Hello! You have received ${invitesReceived}/${invitesNeeded} invites to join the [${channelName}] Signalboost channel. ${
      invitesReceived === invitesNeeded ? 'Please respond with ACCEPT or DECLINE.' : ''
    }`,

  inviteAccepted: `Congrats! Someone has accepted your invite and is now a subscriber to this channel.`,

  promptToUseSignal:
    'This number only accepts messages sent with the Signal Private Messenger. Please install Signal from https://signal.org and try again.',

  rateLimitOccurred: (channelPhoneNumber, resendInterval) =>
    `Message rate limited on channel: ${channelPhoneNumber}.
${
  resendInterval
    ? `next resend attempt in: ${resendInterval.toString().slice(0, -3)} sec`
    : `message has exceeded resend threshold and will not be resent`
}`,

  recycleChannelFailed: phoneNumber => `Failed to recycle channel for phone number: ${phoneNumber}`,

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Signup request received from ${senderNumber}:
${requestMsg}`,

  signupRequestResponse:
    'Thank you for signing up for Signalboost! You will receive a welcome message on your new channel shortly...',

  toRemovedAdmin: 'You were just removed as an admin from this channel. Send HELLO to resubscribe.',

  toRemovedSubscriber:
    'You were just removed from this channel by an Admin. Send HELLO to resubscribe.',

  toggles: commandResponses.toggles,

  vouchLevelChanged: vouchLevel =>
    `An admin just set the vouching level to ${vouchLevel}; joining this channel will now require ${vouchLevel} ${
      vouchLevel > 1 ? 'invites' : 'invite'
    }.`,

  welcome: (addingAdmin, channelPhoneNumber, channelName) =>
    `You were just made an admin of the Signalboost channel [${channelName}] by ${addingAdmin}. Welcome!

People can subscribe to this channel by sending HELLO to ${channelPhoneNumber} and unsubscribe by sending GOODBYE.

Reply with HELP for more info.`,
}

const prefixes = {
  hotlineMessage: messageId => `HOTLINE #${messageId}`,
  hotlineReplyOf: (messageId, memberType) =>
    memberType === memberTypes.ADMIN
      ? `REPLY TO HOTLINE #${messageId}`
      : `PRIVATE REPLY FROM ADMINS`,
  broadcastMessage: `BROADCAST`,
  privateMessage: `PRIVATE`
}

module.exports = {
  commandResponses,
  parseErrors,
  notifications,
  prefixes,
  systemName,
}
