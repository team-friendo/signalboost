const { upperCase } = require('lodash')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../../db/repositories/channel')

const systemName = 'the signalboost system administrator'
const unauthorized = 'Whoops! You are not authorized to do that on this channel.'
const invalidNumber = phoneNumber =>
  `Whoops! "${phoneNumber}" is not a valid phone number. Phone numbers must include country codes prefixed by a '+'.`

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
  adminAdded: commandIssuer => `New Admin ${addedAdmin} added by ${commandIssuer}`,

  broadcastResponseSent: channel =>
    `Your message was forwarded to the admins of [${channel.name}].

Send HELP to see commands I understand! :)`,

  deauthorization: adminPhoneNumber => `
${adminPhoneNumber} has been removed from this channel because their safety number changed.

This is almost certainly because they reinstalled Signal on a new phone.

However, there is a small chance that an attacker has compromised their phone and is trying to impersonate them.

Check with ${adminPhoneNumber} to make sure they still control their phone, then reauthorize them with:

ADD ${adminPhoneNumber}

Until then, they will be unable to send messages to or read messages from this channel.`,
  noop: "Whoops! That's not a command!",
  unauthorized: "Whoops! I don't understand that.\n Send HELP to see commands I understand!",

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
    success: `I will talk to you in English now! 
    
Send HELP to list commands I understand.`,
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
  broadcastResponse: `SUBSCRIBER RESPONSE`,
}

const EN = {
  commandResponses,
  notifications,
  prefixes,
  systemName,
}

module.exports = EN
