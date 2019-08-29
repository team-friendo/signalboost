const unauthorized = 'Whoops! You are not authorized to do that on this channel.'

// NOTE: this is currently deprecated. Leaving it in in case we want to bring it back (aguestuser)
const blurb = `Signalboost is a rapid response tool made by and for activists. It enables users to send free, encrypted text blasts over the Signal messaging service to a mass subscriber list without revealing the sender or recipients' phone numbers to each other.`

const support = `
-----------------
SUPPORT
-----------------

You can view the source code that runs signalboost here:

https://0xacab.org/team-friendo/signalboost

You can submit bugs or request new features here:

https://0xacab.org/team-friendo/signalboost/issues

You can request a new channel or get help from a human by emailing:

team-friendo@riseup.net`

const notifications = {
  welcome: (channel, addingPublisher) => {
    const { name, phoneNumber } = channel
    return `
-----------------------------------------------------
WELCOME TO SIGNALBOOST! <3
-----------------------------------------------------

You were just made a publisher on the [${name}] signalboost channel by ${addingPublisher}.
${commandResponses.info.publisher(channel)}

-----------------------------------------------
BROADCASTING MESSAGES:
-----------------------------------------------

Whenever a publisher sends a Signal message to ${phoneNumber}, it will be broadcast to all channel subscribers (and all publishers).

Anyone can become a subscriber by sending a message that says "HELLO" (or "HOLA") to ${phoneNumber}. They can unsubscribe later by sending a message that says "GOODBYE" (or "ADIOS") to the same number.
${commandResponses.help.publisher}
`
  },
}

const commandResponses = {
  // PUBLISHER
  publisher: {
    add: {
      success: num => `You successfully added ${num} as a publisher!`,
      unauthorized,
      dbError: num => `Whoops! There was an error adding ${num} as publisher. Please try again!`,
      invalidNumber: num =>
        `Whoops! Failed to add "${num}". Phone numbers must include country codes prefixed by a '+'`,
    },
    remove: {
      success: num => `${num} was successfully removed as a publisher.`,
      unauthorized,
      dbError: num => `Whoops! There was an error trying to remove ${num}. Please try again!`,
      invalidNumber: num =>
        `Whoops! Failed to remove "${num}". Phone numbers must include country codes prefixed by a '+'`,
      targetNotPublisher: num => `Whoops! ${num} is not a publisher. Can't remove them.`,
    },
  },
  // HELP
  help: {
    publisher: `
-----------------------------------------
PUBLISHER COMMANDS:
-----------------------------------------

Publishers can send the following commands to this number:

HELP / AYUDA
--> shows this message

ADD +15555555555
--> makes +1 (555) 555-5555 a publisher

REMOVE +15555555555
--> removes +1 (555) 555-5555 as a publisher

GOODBYE / ADIOS
--> removes you from the channel

RENAME new name
--> renames the channel to "new name"

INFO
--> shows basic stats about the channel

-------------------------------------------
SUBSCRIBER COMMANDS:
-------------------------------------------

Subscribers can send the following commands:

HELLO / HOLA
--> subscribes a person to the channel

GOODBYE / ADIOS
--> unsubscribes a person from the channel

HELP / AYUDA , INFO
--> same as above
${support}`,
    subscriber: `
---------------------
COMMANDS:
---------------------

Sending the following commands to this phone number causes the following things to happen:

HELP / AYUDA
--> shows this message

HELLO / HOLA
--> subscribes a person to the channel

GOODBYE / ADIOS
--> unsubscribes a person from the channel

INFO
--> shows basic stats about the channel
${support}`,
    unauthorized,
  },

  // INFO
  info: {
    publisher: channel => `
---------------------------
CHANNEL INFO:
---------------------------

name: ${channel.name}
phone number: ${channel.phoneNumber}
messages sent: ${channel.messageCount.broadcastIn}
subscribers: ${channel.subscriptions.length}
publishers: ${channel.publications.map(a => a.publisherPhoneNumber).join(', ')}`,
    subscriber: channel => `
---------------------------
CHANNEL INFO:
---------------------------

name: ${channel.name}
phone number: ${channel.phoneNumber}
subscribers: ${channel.subscriptions.length}
publishers: ${channel.publications.length}`,
    unauthorized,
  },
  // RENAME
  rename: {
    success: (oldName, newName) =>
      `[${newName}]\nYou successfully renamed the channel from "${oldName}" to "${newName}".`,
    dbError: (oldName, newName) =>
      `[${oldName}]\nWhoops! There was an error renaming the channel [${oldName}] to [${newName}]. Try again!`,
    unauthorized,
  },
  // SUBSCRIBER
  subscriber: {
    add: {
      success: channel => {
        const { name, phoneNumber } = channel
        return `
--------------------------------------------------------
<3 WELCOME TO SIGNALBOOST! <3
--------------------------------------------------------

You just subscribed to the [${name}] signalboost channel on ${phoneNumber}. You can unsubscribe by sending a message that says "LEAVE" to this number at any time.
${commandResponses.info.subscriber(channel)}
${commandResponses.help.subscriber}`
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
}

const messages = {
  commandResponses,
  notifications,
  reportBackForwarded: channel => `Your message was forwarded to the admins of [${channel.name}]`,
  unauthorized:
    'Whoops! You are not a publisher on this channel. Only publishers can send messages. Sorry! :)',
  noop: "Whoops! That's not a command!",
}

module.exports = messages
