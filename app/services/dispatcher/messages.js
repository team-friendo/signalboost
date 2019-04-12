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
