const commandResponses = {
  // ADMIN
  admin: {
    add: {
      success: num => `You successfully added ${num} as an admin!`,
      error: num => `Whoops! There was an error adding ${num} as admin. Please try again!`,
      noop: {
        notAdmin: `[NOPREFIX]Whoops! You are not an admin of this channel. We can't let you add other admins to it. Sorry!`,
        invalidNumber: num =>
          `Whoops! Signalboost could not understand "${num}." Phone numbers must include country codes but omit commas, dashes, parentheses, and spaces. \n\nFor example: to add (202) 555-4444, write:\n\n "ADD ADMIN +12025554444"`,
      },
    },
    remove: {
      success: num => `${num} was successfully removed as an admin.`,
      error: num => `Whoops! There was an error trying to remove ${num}. Please try again!`,
      noop: {
        senderNotAdmin: `Whoops! You are not an admin of this channel. We can't let you add other admins to it. Sorry!`,
        invalidNumber: num =>
          `Whoops! Signalboost could not understand "${num}." Phone numbers must include country codes but omit commas, dashes, parentheses, and spaces.\n\nFor example: to remove (202) 555-4444, write:\n\n "REMOVE ADMIN +12025554444"`,
        targetNotAdmin: num => `Whoops! ${num} is not an admin. Can't remove them.`,
      },
    },
  },
  // INFO
  info: {
    admin: (channel, administrations, subscriptions) =>
      `\n- phone number: ${channel.phoneNumber}\n- subscribers: ${
        subscriptions.length
      }\n- admins: ${administrations.map(a => a.humanPhoneNumber).join(', ')}`,
    subscriber: (channel, admins, subscriptions) =>
      `\n- phone number: ${channel.phoneNumber}\n- subscribers: ${
        subscriptions.length
      }\n- admins: ${admins.length}`,
    noop: `[NOPREFIX]Whoops! You cannot retrieve info for a channel you do not belong to.`,
  },
  // RENAME
  rename: {
    success: (oldName, newName) =>
      `[NOPREFIX][${newName}]\nYou successfully renamed the channel from "${oldName}" to "${newName}".`,
    error: (oldName, newName) =>
      `Whoops! There was an error renaming the channel [${oldName}] to [${newName}]. Try again!`,
    noop: `[NOPREFIX]Sorry, you are not an admin of that channel. Can't rename a thing that's not yours. ;)`,
  },
  // SUBSCRIBER
  subscriber: {
    add: {
      success: `You've been added to the channel!`,
      error: `Whoops! There was an error adding you to the channel. Please try again!`,
      noop: `Whoops! You are already a member of the channel.`,
    },
    remove: {
      success: `You've been removed from the channel! Bye!`,
      error: `Whoops! There was an error removing you from the channel. Please try again!`,
      noop: '[NOPREFIX]Whoops! You are not subscribed to that channel. How ya gonna leave it?',
    },
  },
}

const messages = {
  commandResponses,
  notAdmin:
    '[NOPREFIX]Whoops! You are not an admin for this group. Only admins can send messages. Sorry! :)',
  noop: "Whoops! That's not a command!",
}

module.exports = messages
