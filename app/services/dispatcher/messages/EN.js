const { upperCase } = require('lodash')

const unauthorized = 'Whoops! You are not authorized to do that on this channel.'
const invalidNumber = phoneNumber =>
  `Whoops! "${phoneNumber}" is not a valid phone number. Phone numbers must include country codes prefixed by a '+'.`

const support = `
----------------------------
HOW IT WORKS
----------------------------

-> Signalboost numbers have admins and subscribers.
-> Admins send announcements that are broadcasted to subscribers.
-> Subscribe to announcements by sending "HELLO" to a number.
-> Unsubscribe by sending "GOODBYE" to the number.
-> Send "HELP" to a number to list commands that make it do things.
-> Learn more: https://0xacab.org/team-friendo/signalboost
`

const notifications = {
  publisherAdded: (commandIssuer, addedPublisher) => `New admin ${addedPublisher} added by ${commandIssuer}`,
  broadcastResponseSent: channel => `Your message was forwarded to the admins of [${channel.name}]`,
  deauthorization: publisherPhoneNumber => `
${publisherPhoneNumber} has been removed from this channel because their safety number changed.

This is almost certainly because they reinstalled Signal on a new phone.

However, there is a small chance that an attacker has compromised their phone and is trying to impersonate them.

Check with ${publisherPhoneNumber} to make sure they still control their phone, then reauthorize them with:

ADD ${publisherPhoneNumber}

Until then, they will be unable to send messages to or read messages from this channel.`,
  noop: "Whoops! That's not a command!",
  unauthorized: "Whoops! I don't understand that.\n Send HELP to see commands I understand!",
  welcome: addingPublisher => `
You were just made an admin of this signalboost channel by ${addingPublisher}. Welcome!

Reply with HELP for more information or GOODBYE to leave.`,
}

const commandResponses = {
  // ADD/REMOVE PUBLISHER
  publisher: {
    add: {
      success: num => `${num} added as an admin.`,
      unauthorized,
      dbError: num => `Whoops! There was an error adding ${num} as an admin. Please try again!`,
      invalidNumber,
    },
    remove: {
      success: num => `${num} removed as an admin.`,
      unauthorized,
      dbError: num => `Whoops! There was an error trying to remove ${num}. Please try again!`,
      invalidNumber,
      targetNotPublisher: num => `Whoops! ${num} is not an admin. Can't remove them.`,
    },
  },
  // HELP
  help: {
    publisher: `
HELP / AYUDA
-> lists commands

INFO
-> shows stats, explains signalboost

RENAME new name
-> renames channel to "new name"

RESPONSES ON / RESPONSES OFF
-> enables/disables subscscriber responses

ADD +1-555-555-5555
-> makes +1-555-555-5555 an admin

REMOVE +1-555-555-5555
-> removes +1-555-555-5555 as an admin

REAUTHORIZE +1-555-555-5555
-> restores admin rights to +1-555-555-5555 after they have re-installed signal
-> (admin rights are taken away when an admin reinstalls signal to protect from an attacker impersonating the admin)

GOODBYE / ADIOS
-> removes you from channel`,
    subscriber: `
HELP / AYUDA
-> lists commands

INFO
-> explains signalboost

HELLO / HOLA
-> subscribes you to messages

GOODBYE / ADIOS
-> unsubscribes you

`,
  },

  // INFO
  info: {
    publisher: channel => `
---------------------------
CHANNEL INFO:
---------------------------

name: ${channel.name}
phone number: ${channel.phoneNumber}
subscribers: ${channel.subscriptions.length}
publishers: ${channel.publications.map(a => a.publisherPhoneNumber).join(', ')}
responses: ${channel.responsesEnabled ? 'ON' : 'OFF'}
messages sent: ${channel.messageCount.broadcastIn}
${support}`,
    subscriber: channel => `
---------------------------
CHANNEL INFO:
---------------------------

name: ${channel.name}
phone number: ${channel.phoneNumber}
responses: ${channel.responsesEnabled ? 'ON' : 'OFF'}
subscribers: ${channel.subscriptions.length}
publishers: ${channel.publications.length}
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
  // JOIN/LEAVE
  subscriber: {
    add: {
      success: channel => {
        const { name } = channel
        return `
Welcome to Signalboost! You are now subscribed to the [${name}] channel.

Reply with HELP to learn more or GOODBYE to unsubscribe.`
      },
      dbError: `Whoops! There was an error adding you to the channel. Please try again!`,
      noop: `Whoops! You are already a member of the channel.`,
    },
    remove: {
      success: `You've been removed from the channel! Bye!`,
      error: `Whoops! There was an error removing you from the channel. Please try again!`,
      unauthorized,
    },
  },
  // TOGGLE RESPONSES
  toggleResponses: {
    success: setting => `Subscriber responses turned ${upperCase(setting)}.`,
    unauthorized,
    dbError: setting =>
      `Whoops! There was an error trying to set responses to ${setting}. Please try again!`,
    invalidSetting: setting =>
      `Whoops! ${setting} is not a valid setting. You can set responses to be either ON or OFF.`,
  },
  trust: {
    success: phoneNumber => `Updated safety number for ${phoneNumber}`,
    error: phoneNumber =>
      `Failed to update safety number for ${phoneNumber}. Try again or contact a maintainer!`,
    partialError: (phoneNumber, success, error) =>
      `Updated safety number for ${success} out of ${success +
        error} channels that ${phoneNumber} belongs to.`,
    invalidNumber,
    unauthorized,
    targetNotMember: phoneNumber =>
      `Whoops! ${phoneNumber} is not an admin or subscriber on this channel. Cannot reactivate them.`,
    dbError: phoneNumber =>
      `Whoops! There was an error updating the safety number for ${phoneNumber}. Please try again!`,
  },
}

const prefixes = {
  helpResponse: `COMMANDS I UNDERSTAND...`,
  broadcastResponse: `SUBSCRIBER RESPONSE...`,
}

const EN = {
  commandResponses,
  notifications,
  prefixes,
}

module.exports = EN
