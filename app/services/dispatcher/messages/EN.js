const { upperCase } = require('lodash')
const unauthorized = 'Whoops! You are not authorized to do that on this channel.'

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
  broadcastResponseSent: channel => `Your message was forwarded to the admins of [${channel.name}]`,
  welcome: (channel, addingPublisher) => {
    const { name } = channel
    return `
Welcome to Signalboost! You were just made an admin of the [${name}] channel by ${addingPublisher}.

Reply with HELP for more information or GOODBYE to leave.`
  },
  noop: "Whoops! That's not a command!",
  unauthorized: "Whoops! I don't understand that.\n Send HELP to see commands I understand!",
}

const commandResponses = {
  // ADD/REMOVE PUBLISHER
  publisher: {
    add: {
      success: num => `${num} added as an admin.`,
      unauthorized,
      dbError: num => `Whoops! There was an error adding ${num} as an admin. Please try again!`,
      invalidNumber: num =>
        `Whoops! Failed to add "${num}". Phone numbers must include country codes prefixed by a '+'`,
    },
    remove: {
      success: num => `${num} removed as an admin.`,
      unauthorized,
      dbError: num => `Whoops! There was an error trying to remove ${num}. Please try again!`,
      invalidNumber: num =>
        `Whoops! Failed to remove "${num}". Phone numbers must include country codes prefixed by a '+'`,
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
-> unsubscribes you`,
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
  // ADD/REMOVE SUBSCRIBER
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
