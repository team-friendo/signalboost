const { memberTypes } = require('../../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')

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
-> If enabled, subscribers can send anonymous messages to the hotline.

Signalboost protects your privacy:

-> Users cannot see other users' phone numbers. (Cops can't either!)
-> Signalboost does not read or store the contents of anyone's messages.

Signalboost responds to commands:

-> Send HELP to list them.

Learn more: https://signalboost.info`

const parseErrors = {
  invalidPhoneNumber: phoneNumber =>
    `"${phoneNumber}" is not a valid phone number. Phone numbers must include country codes prefixed by a '+'.`,
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
    belowThreshold: (channel, required, actual) =>
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

INVITE +1-555-555-5555
-> invites +1-555-555-5555 to subscribe to the channel

ADD / REMOVE +1-555-555-5555
-> adds or removes +1-555-555-5555 as an admin of the channel

HOTLINE ON / OFF
-> enables or disables hotline

VOUCHING ON / OFF
-> enables or disables requirement to receive an invite to subscribe

ESPAÑOL / FRANÇAIS
-> switches language to Spanish or French

GOODBYE
-> leaves this channel`,

    subscriber: `----------------------------------------------
COMMANDS
----------------------------------------------

HELP
-> lists commands

INFO
-> shows stats, explains how Signalboost works

----------------------------------------------

INVITE +1-555-555-5555
-> invites +1-555-555-5555 to subscribe to the channel

ESPAÑOL / FRANÇAIS
-> switches language to Spanish or French

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
${channel.description ? `description: ${channel.description}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
CHANNEL INFO
---------------------------

You are subscribed to this channel.

name: ${channel.name}
phone number: ${channel.phoneNumber}
hotline: ${onOrOff(channel.hotlineOn)}
vouching: ${onOrOff(channel.vouchingOn)}
subscribers: ${getSubscriberMemberships(channel).length}
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
    success: `Issued invitation.`,
    dbError: 'Whoops! Failed to issue invitation. Please try again. :)',
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

  // REMOVE

  remove: {
    success: num => `${num} removed as an admin.`,
    notAdmin,
    dbError: num => `Whoops! There was an error trying to remove ${num}. Please try again!`,
    invalidPhoneNumber,
    targetNotAdmin: num => `Whoops! ${num} is not an admin. Can't remove them.`,
  },

  // RENAME

  rename: {
    success: (oldName, newName) =>
      `[${newName}]\nChannel renamed from "${oldName}" to "${newName}".`,
    dbError: (oldName, newName) =>
      `[${oldName}]\nWhoops! There was an error renaming the channel [${oldName}] to [${newName}]. Try again!`,
    notAdmin,
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
      success: isOn => `Vouching turned ${onOrOff(isOn)}.`,
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

  adminLeft: 'An admin just left the channel.',

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

Send HELP to list valid commands. Send HELLO to subscribe.

(Note: all messages are forwarded anonymously. Include your phone number if you want admins to respond to you individually.)`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Sorry, this channel does not have a hotline enabled. Send HELP to list valid commands.'
      : 'Sorry, this channel does not have a hotline enabled. Send HELP to list valid commands or HELLO to subscribe.',

  inviteReceived: channelName => `You have been invited to the [${channelName}] Signalboost channel. Would you like to subscribe to announcements from this channel?

Please respond with ACCEPT or DECLINE.`,

  rateLimitOccurred: (channelPhoneNumber, memberPhoneNumber, resendInterval) =>
    `Message failed to send due to a rate limit error.
channel: ${channelPhoneNumber}
recipient: ${memberPhoneNumber}
${
  resendInterval
    ? `next resend attempt in: ${resendInterval.toString().slice(0, -3)} sec`
    : `message has exceeded resend threshold and will not be resent`
}`,

  recycleChannelFailed: phoneNumber => `Failed to recycle channel for phone number: ${phoneNumber}`,

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Signup request received from ${senderNumber}:\n ${requestMsg}`,

  signupRequestResponse:
    'Thank you for signing up for Signalboost! You will receive a welcome message on your new channel shortly...',

  toRemovedAdmin: 'You were just removed as an admin from this channel. Send HELLO to resubscribe.',

  toggles: commandResponses.toggles,

  welcome: (addingAdmin, channelPhoneNumber) =>
    `You were just made an admin of this Signalboost channel by ${addingAdmin}. Welcome!

People can subscribe to this channel by sending HELLO to ${channelPhoneNumber} and unsubscribe by sending GOODBYE.

Reply with HELP for more info.`,
}

const prefixes = {
  hotlineMessage: `HOTLINE MESSAGE`,
}

module.exports = {
  commandResponses,
  parseErrors,
  notifications,
  prefixes,
  systemName,
}
