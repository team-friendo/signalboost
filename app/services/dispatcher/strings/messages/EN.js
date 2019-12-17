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
const invalidNumber = phoneNumber =>
  `"${phoneNumber}" is not a valid phone number. Phone numbers must include country codes prefixed by a '+'.`
const onOrOff = isOn => (isOn ? 'on' : 'off')

const support = `----------------------------
HOW IT WORKS
----------------------------

Signalboost channels have admins and subscribers.

-> When admins send messages, they are broadcast to all subscribers.
-> If enabled, subscribers can send responses that only admins can read.
-> Subscribers cannot send messages to each other. (No noisy crosstalk!)

Signalboost channels understand commands.

-> Sending HELP lists the commands.
-> People can subscribe by sending HELLO (or HOLA) and unsubscribe with GOODBYE (or ADIÓS).
-> Sending a language name (for example: ESPAÑOL or ENGLISH) switches languages.

Signalboost tries to preserve your privacy.

-> Signalboost users cannot see each other's phone numbers.
-> Signalboost does not read or store anyone's messages.

Learn more: https://signalboost.info`

const notifications = {
  adminAdded: (commandIssuer, addedAdmin) => `New Admin ${addedAdmin} added by ${commandIssuer}`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} has been removed from this channel because their safety number changed.

This is almost certainly because they reinstalled Signal on a new phone.

However, there is a small chance that an attacker has compromised their phone and is trying to impersonate them.

Check with ${adminPhoneNumber} to make sure they still control their phone, then reauthorize them with:

ADD ${adminPhoneNumber}

Until then, they will be unable to send messages to or read messages from this channel.`,

  hotlineMessageSent: channel =>
    `Your message was anonymously forwarded to the admins of [${
      channel.name
    }]. Include your phone number if you want admins to respond to you individually.

Send HELP to list valid commands.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Sorry, incoming messages are not enabled on this channel. Send HELP to list valid commands.'
      : 'Sorry, incoming messages are not enabled on this channel. Send HELP to list valid commands or HELLO to subscribe.',

  inviteReceived: channelName => `You have been invited to the [${channelName}] Signalboost channel. Would you like to subscribe to announcements from this channel?

Please respond with ACCEPT or DECLINE.`,

  welcome: (addingAdmin, channelPhoneNumber) => `
You were just made an admin of this Signalboost channel by ${addingAdmin}. Welcome!

People can subscribe to this channel by sending HELLO to ${channelPhoneNumber} and unsubscribe by sending GOODBYE.

Reply with HELP for more info.`,

  signupRequestReceived: (senderNumber, requestMsg) =>
    `Signup request received from ${senderNumber}:\n ${requestMsg}`,

  signupRequestResponse:
    'Thank you for signing up for Signalboost! You will receive a welcome message on your new channel shortly...',
}

const commandResponses = {
  // ACCEPT

  accept: {
    success: channel => `Hi! You are now subscribed to the [${channel.name}] Signalboost channel.

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
    invalidNumber,
  },

  // DECLINE

  decline: {
    success: 'Invitation declined. All information about invitation deleted.',
    dbError: 'Whoops! There was an error declining the invite. Please try again!',
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

ESPAÑOL / FRANÇAIS
-> switches language to Spanish or French`,

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
-> unsubscribes you from announcements

ESPAÑOL / FRANÇAIS
-> switches language to Spanish or French`,
  },

  // INFO

  info: {
    [memberTypes.ADMIN]: channel => `---------------------------
CHANNEL INFO:
---------------------------

You are an admin of this channel.

name: ${channel.name}
phone number: ${channel.phoneNumber}
admins: ${getAdminMemberships(channel).length}
subscribers: ${getSubscriberMemberships(channel).length}
responses: ${channel.responsesEnabled ? 'ON' : 'OFF'}
messages sent: ${channel.messageCount.broadcastIn}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
CHANNEL INFO:
---------------------------

You are subscribed to this channel.

name: ${channel.name}
phone number: ${channel.phoneNumber}
responses: ${channel.responsesEnabled ? 'ON' : 'OFF'}
subscribers: ${getSubscriberMemberships(channel).length}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
CHANNEL INFO:
---------------------------

You are not subscribed to this channel. Send HELLO to subscribe.

name: ${channel.name}
phone number: ${channel.phoneNumber}
subscribers: ${getSubscriberMemberships(channel).length}

${support}`,
  },

  // INVITE

  invite: {
    notSubscriber,
    invalidNumber: input => `Whoops! Failed to issue invitation. ${invalidNumber(input)}`,
    success: `Issued invitation.`,
    dbError: 'Whoops! Failed to issue invitation. Please try again. :)',
  },

  // JOIN

  join: {
    success: channel => `Hi! You are now subscribed to the [${channel.name}] Signalboost channel.

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
    invalidNumber,
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

  // TOGGLES (RESPONSES, VOUCHING)

  toggles: {
    responses: {
      success: isOn => `Subscriber responses turned ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `Whoops! There was an error trying to set responses to ${onOrOff(isOn)}. Please try again!`,
    },
    vouching: {
      success: isOn => `Vouching turned ${onOrOff(isOn)}`,
      notAdmin,
      dbError: isOn =>
        `Whoops! There was an error trying to set vouching to ${onOrOff(isOn)}. Please try again!`,
    },
  },

  // TRUST

  trust: {
    success: phoneNumber => `Updated safety number for ${phoneNumber}`,
    error: phoneNumber =>
      `Failed to update safety number for ${phoneNumber}. Try again or contact a maintainer!`,
    invalidNumber,
    notAdmin,
    dbError: phoneNumber =>
      `Whoops! There was an error updating the safety number for ${phoneNumber}. Please try again!`,
  },
}

const prefixes = {
  // TODO(aguestuser|2019-12-21): change this to HOTLINE MESSAGE
  hotlineMessage: `SUBSCRIBER RESPONSE`,
}

module.exports = {
  commandResponses,
  notifications,
  prefixes,
  systemName,
}
