const { upperCase } = require('lodash')
const unauthorized = 'Whoops! You are not authorized to do that on this channel.'

// NOTE: this is currently deprecated. Leaving it in in case we want to bring it back (aguestuser)
const blurb = `Signalboost is a rapid response tool made by and for activists. It enables users to send free, encrypted text blasts over the Signal messaging service to a mass subscriber list without revealing the sender or recipients' phone numbers to each other.`

const support = `
----------------------------
HOW IT WORKS
----------------------------

-> It's safe: Nobody can see anyone else's phone number on Signalboost, and all messages are encrypted.
-> It's simple: Messages on Signalboost are one-way: from admins to subscribers.
-> It's free: This app is built by activists for activists. We won't ever charge you fees or spy on you for money!

----------------------------
DETAILS
----------------------------

-> When an admin sends a message to a Signalboost channel, it is broadcast to all channel subscribers (and other admins).
-> People can subscribe by sending a message that says "HELLO" (or "HOLA") to the channel phone number.
-> People can unsubscribe by sending a message that says "GOODBYE" (or "ADIOS") to the channel phone number.
-> People can interact with Signalboost with commands, which they can discover by sending a "HELP" message.
-> Learn more (and see the code that runs Signalboost) here: https://0xacab.org/team-friendo/signalboost
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

const messages = {
  commandResponses,
  notifications,
  prefixes,
}

module.exports = messages
