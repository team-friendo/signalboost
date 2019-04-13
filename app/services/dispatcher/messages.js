const unauthorized = 'Whoops! You are not authorized to do that on this channel.'

const commandResponses = {
  // ADMIN
  admin: {
    add: {
      success: num => `You successfully added ${num} as an admin!`,
      unauthorized,
      dbError: num => `Whoops! There was an error adding ${num} as admin. Please try again!`,
      invalidNumber: num =>
        `Whoops! Signalboost could not understand "${num}." Phone numbers must include country codes but omit commas, dashes, parentheses, and spaces. \n\nFor example: to add (202) 555-4444, write:\n\n "ADD ADMIN +12025554444"`,
    },
    remove: {
      success: num => `${num} was successfully removed as an admin.`,
      unauthorized,
      dbError: num => `Whoops! There was an error trying to remove ${num}. Please try again!`,
      invalidNumber: num =>
        `Whoops! Signalboost could not understand "${num}." Phone numbers must include country codes but omit commas, dashes, parentheses, and spaces.\n\nFor example: to remove (202) 555-4444, write:\n\n "REMOVE ADMIN +12025554444"`,
      targetNotAdmin: num => `Whoops! ${num} is not an admin. Can't remove them.`,
    },
  },
  // HELP
  help: {
    admin: `
-----------------------------------
ADMIN COMMANDS:
-----------------------------------

You can send these commands to do these things:

HELP
- shows this message

ADD +15555555555
- makes the person with phone number +1 (555) 555-5555 an admin of the channel -- they can now broadcast messages on it

REMOVE +15555555555
- removes the person with phone number +1 (555) 555-5555 as an admin of the channel -- they can no longer broadcast messages on it

LEAVE
- removes you as both an admin and subscriber of the channel -- you can no longer broadcast or receive messages on it

RENAME new name
- renames the channel to "new name"

INFO
- shows basic stats about the channel

-------------------------------------------
NON-ADMIN COMMANDS:
-------------------------------------------

Anyone can send these commands to do these things:

JOIN
- subscribes a person to the channel -- they will receive all messages admins send to it

LEAVE
- will unsubscribe a person from the channel --  they stop receiving messages sent on it

HELP / INFO
- same as above

--------------------------------------------------------
SOURCE CODE / ISSUE-TRACKING
--------------------------------------------------------

You can view the source code that runs signalboost here:
- https://0xacab.org/team-friendo/signalboost

You can submit bugs or request new features here:
- https://0xacab.org/team-friendo/signalboost/issues
`,
    subscriber: `
------------------------------------------------------------------------------------
COMMANDS:
------------------------------------------------------------------------------------

You can send the following commands to this number to cause the following things to happen:

HELP
- shows this message

JOIN
- subscribes you to the channel -- you will receive all messages admins send to it

LEAVE
- will unsubscribe a person from the channel --  you will stop receiving messages sent on it

INFO
- shows basic stats about the channel

------------------------------------------------------------------------------------
SOURCE CODE / ISSUE-TRACKING
------------------------------------------------------------------------------------

You can view the source code that runs signalboost here:
- https://0xacab.org/team-friendo/signalboost

You can submit bugs or request new features here:
- https://0xacab.org/team-friendo/signalboost/issues
`,
    unauthorized,
  },

  // INFO
  info: {
    admin: channel =>
      `\n- phone number: ${channel.phoneNumber}\n- subscribers: ${
        channel.subscriptions.length
      }\n- admins: ${channel.administrations.map(a => a.humanPhoneNumber).join(', ')}`,
    subscriber: channel =>
      `\n- phone number: ${channel.phoneNumber}\n- subscribers: ${
        channel.subscriptions.length
      }\n- admins: ${channel.administrations.length}`,
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
      success: `You've been added to the channel!`,
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
  unauthorized:
    'Whoops! You are not an admin for this group. Only admins can send messages. Sorry! :)',
  noop: "Whoops! That's not a command!",
}

module.exports = messages
