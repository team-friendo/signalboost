const { upperCase } = require('lodash')
const { memberTypes } = require('../../../db/repositories/membership')
const {
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../../db/repositories/channel')
const {
  signal: { maxVouchLevel },
} = require('../../../config')

const systemName = 'the Signalboost system administrator'
const notAdmin =
  'Sorry, only admins are allowed to issue that command. Send HELP for a list of valid commands.'
const notSubscriber =
  'Your command could not be processed because you are not subscribed to this channel. Send HELLO to subscribe.'
const subscriberLimitReached = subscriberLimit =>
  `Sorry, this channel has reached its limit of ${subscriberLimit} subscribers.`
const onOrOff = isOn => (isOn ? 'on' : 'off')

const vouchModeDisplay = {
  ON: 'on',
  ADMIN: 'admin',
  OFF: 'off',
}

const support = `----------------------------
HOW IT WORKS
----------------------------

Signalboost has channels with admins and subscribers:

-> When admins send announcements, they are broadcast to all subscribers.
-> If the hotline is enabled, anyone can send anonymous messages to the admins.

Signalboost protects your privacy:

-> Users cannot see other users' phone numbers.
-> Signalboost does not read or store the contents of anyone's messages.

Signalboost responds to commands:

-> Send HELP to list them.

Learn more: https://signalboost.info`

const validPhoneNumberHint = `Phone numbers must include country codes prefixed by a '+'.`

const parseErrors = {
  unnecessaryPayload: command =>
    `Sorry, that command was not recognized.
    
Did you mean to use ${upperCase(command)} or BROADCAST?

Send HELP for a list of all valid commands and how to use them.`,

  invalidPhoneNumber: phoneNumber =>
    `"${phoneNumber}" is not a valid phone number. ${validPhoneNumberHint}`,

  invalidPhoneNumbers: phoneNumbers =>
    `"${phoneNumbers.join(', ')}" are not valid phone numbers. ${validPhoneNumberHint}`,

  invalidVouchLevel: vouchLevel =>
    `"${vouchLevel}" is not a valid vouch level. Please use a number between 1 and ${maxVouchLevel}.`,

  invalidHotlineMessageId: payload =>
    `Were you trying to reply to a hotline message? Sorry, ${payload} is not a valid hotline ID. A valid hotline ID looks like: @123`,
}

const invalidPhoneNumber = parseErrors.invalidPhoneNumber

const commandResponses = {
  // ACCEPT

  accept: {
    success: channel => `Hi! You are now subscribed to the [${channel.name}] Signalboost channel.

Reply with HELP to learn more or GOODBYE to unsubscribe.`,
    alreadyMember: 'Sorry, you are already a member of this channel',
    belowVouchLevel: (channel, required, actual) =>
      `Sorry, ${channel.name} requires ${required} invite(s) to join. You have ${actual}.`,
    dbError: 'Whoops! There was an error accepting your invite. Please try again!',
    subscriberLimitReached,
  },

  // ADD

  add: {
    success: newAdmin => `${newAdmin.memberPhoneNumber} added as ADMIN ${newAdmin.adminId}.`,
    notAdmin,
    dbError: num => `Whoops! There was an error adding ${num} as an admin. Please try again!`,
    invalidPhoneNumber,
  },

  // BROADCAST
  broadcast: {
    notAdmin,
  },

  // DECLINE

  decline: {
    success: 'Invitation declined. All information about invitation deleted.',
    dbError: 'Whoops! There was an error declining the invite. Please try again!',
  },

  destroy: {
    confirm: `Are you sure?

If you continue, you will permanently destroy this channel and all records associated with it.

To continue, respond with:

CONFIRM DESTROY`,
    success: 'Channel and all associated records have been permanently destroyed.',
    notAdmin,
    error: 'Oops! There was an error destroying the channel. Please try again!',
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

BROADCAST hello everyone / ! hello everyone
-> broadcasts "hello everyone" to all the subscribers of this channel

@1312
-> sends private reply to [HOTLINE @1312]

INVITE +1-555-555-5555, +1-444-444-4444
-> invites +1-555-555-5555 and +1-444-444-4444 to subscribe to this channel

ADD +1-555-555-5555
-> adds +1-555-555-5555 as an admin of the channel

PRIVATE hello admins / ! hello admins
-> sends private message "hello admins" to all admins of the channel

ESPAÑOL / FRANÇAIS / DEUTSCH
-> switches language to Spanish, French or German

HOTLINE ON / OFF
-> enables or disables hotline

VOUCHING ON / OFF / ADMIN 
-> toggles vouching on/off. When ON, people must be invited to join the channel. When ADMIN, only admins can send those invites.

VOUCH LEVEL level
-> changes the number of invites needed to join the channel

REMOVE +1-555-555-5555
-> removes +1-555-555-5555 from the channel

GOODBYE
-> leaves this channel

DESTROY
-> permanently destroys this channel and all associated records`,

    subscriber: `----------------------------------------------
COMMANDS
----------------------------------------------

HELP
-> lists commands

INFO
-> shows stats, explains how Signalboost works

----------------------------------------------

INVITE +1-555-555-5555, +1-444-444-4444
-> invites +1-555-555-5555 and +1-444-444-4444 to subscribe to the channel

ESPAÑOL / FRANÇAIS / DEUTSCH
-> switches language to Spanish, French or German

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
vouching: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `vouch level: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.SUBSCRIBER]: channel => `---------------------------
CHANNEL INFO
---------------------------

You are subscribed to this channel.

name: ${channel.name}
phone number: ${channel.phoneNumber}
hotline: ${onOrOff(channel.hotlineOn)}
vouching: ${vouchModeDisplay[channel.vouchMode]}
${channel.vouchMode !== 'OFF' ? `vouch level: ${channel.vouchLevel}` : ''}

${support}`,

    [memberTypes.NONE]: channel => `---------------------------
CHANNEL INFO
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
    invalidPhoneNumber: input => `Whoops! Failed to issue invitation. ${invalidPhoneNumber(input)}`,
    success: n => (n === 1 ? `Invite issued.` : `${n} invites issued.`),
    adminOnly: 'Sorry, only admins can invite people to this channel.',
    dbError: 'Oops! Failed to issue invitation. Please try again. :)',

    dbErrors: (failedPhoneNumbers, inviteCount) => `Oops! Failed to issue invitations for ${
      failedPhoneNumbers.length
    } out of ${inviteCount} phone numbers.

Please trying issuing INVITE again for the following numbers:

${failedPhoneNumbers.join(',')}`,

    subscriberLimitReached: (numInvitees, subscriberLimit, subscriberCount) =>
      `Trying to invite ${numInvitees} new subscriber(s)? Sorry, this channel is limited to ${subscriberLimit} subscribers and already has ${subscriberCount} subscribers.`,
  },

  // JOIN

  join: {
    success: channel => `Hi! You are now subscribed to the [${channel.name}] Signalboost channel.

Reply with HELP to learn more or GOODBYE to unsubscribe.`,
    inviteRequired: `Sorry! Invites are required to subscribe to this channel. Ask a friend to invite you!

If you already have an invite, try sending ACCEPT`,
    dbError: `Whoops! There was an error adding you to the channel. Please try again!`,
    alreadyMember: `Whoops! You are already a member of this channel.`,
    subscriberLimitReached,
  },

  // LEAVE
  leave: {
    success: `You've been removed from the channel! Bye!`,
    error: `Whoops! There was an error removing you from the channel. Please try again!`,
    notSubscriber,
  },

  // PRIVATE

  private: {
    notAdmin,
    signalError: `Whoops! There was an error trying to private message the admins of this channel. Please try again!`,
  },

  // REMOVE
  remove: {
    success: num => `${num} was removed.`,
    notAdmin,
    targetNotMember: num => `Ooops! ${num} is not a member of this channel!`,
    dbError: num => `Whoops! There was an error trying to remove ${num}. Please try again!`,
    invalidPhoneNumber,
  },

  // REPLY

  hotlineReply: {
    success: hotlineReply => notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
    notAdmin,
    invalidMessageId: messageId =>
      `Sorry, the hotline message ID @${messageId} has expired or never existed.`,
  },

  // SET_LANGUAGE

  setLanguage: {
    success: `Your channel language is now set to English! 
    
Send HELP to list commands you can use.`,
    dbError: 'Whoops! Failed to store your language preference. Please try again!',
  },

  // TOGGLES (HOTLINE)

  toggles: {
    hotline: {
      success: isOn => `Hotline turned ${onOrOff(isOn)}.`,
      notAdmin,
      dbError: isOn =>
        `Whoops! There was an error trying to turn the hotline ${onOrOff(isOn)}. Please try again!`,
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

  // VOUCHING
  vouchMode: {
    success: (mode, adminId) => {
      const vouchingStatus = adminId
        ? `ADMIN ${adminId} set vouching ${vouchModeDisplay[mode]}.`
        : `Vouching is now ${vouchModeDisplay[mode]}.`

      const explanation = {
        ON: `This means an invite from an existing member is required to join this channel.
Anyone can send an invite by sending INVITE +1-555-123-1234.

Admins can adjust the number of invites needed to join by using the VOUCH LEVEL command.`,
        OFF: `This means that anyone can join the channel by sending HELLO to the channel number.`,
        ADMIN: `This means that an invite from an *admin* is required to join this channel.
Anyone can send an invite by sending INVITE +1-555-123-1234.

Admins can adjust the number of invites needed to join by using the VOUCH LEVEL command.`,
      }[mode]

      return `${vouchingStatus}

${explanation}`
    },
    notAdmin,
    dbError: 'There was an error updating vouching for your channel. Please try again.',
  },

  // VOUCH_LEVEL
  vouchLevel: {
    success: level =>
      `Vouching level set to ${level}. It will now take ${level} ${
        level > 1 ? 'invites' : 'invite'
      } for new subscribers to join this channel.`,
    invalid: parseErrors.invalidVouchLevel,
    notAdmin,
    dbError: 'There was an error updating the vouching level. Please try again.',
  },

  // NONE
  none: {
    error:
      'Did you mean to prefix your message with BROADCAST? Send HELP to see a list of all commands.',
  },
}

const notifications = {
  adminAdded: (adderAdminId, addedAdminId) => `ADMIN ${adderAdminId} added ADMIN ${addedAdminId}.`,

  adminRemoved: (removerAdminId, removedAdminId) =>
    `ADMIN ${removerAdminId} removed ADMIN ${removedAdminId}.`,

  subscriberRemoved: adminId => `A subscriber was just removed by ADMIN ${adminId}.`,

  adminLeft: adminId => `ADMIN ${adminId} just left the channel.`,

  channelDestroyedByAdmin: (audience, adminId) =>
    ({
      ADMIN: `ADMIN ${adminId} has destroyed this channel. All associated data has been deleted.`,
      SUBSCRIBER:
        'Channel and all associated data has been permanently destroyed by the admins of this channel.',
    }[audience]),

  channelDestructionScheduled: hoursToLive =>
    `Hello! This channel will be destroyed in ${hoursToLive} hours due to lack of use.

To prevent it from being destroyed, send INFO within the next ${hoursToLive} hours.

If you would like to destroy the channel right now, respond with DESTROY.

For more information, visit signalboost.info/how-to.`,

  channelDestructionFailed: phoneNumber =>
    `Failed to destroy channel for phone number: ${phoneNumber}`,

  channelDestroyedBySystem:
    'Channel destroyed due to lack of use. To create a new channel, visit https://signalboost.info',

  channelRedeemed:
    'This channel was scheduled to be destroyed due to lack of use. However, since you used the channel recently, it will no longer be destroyed. Yay!',

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
  
Send HELP to list valid commands. Send HELLO to subscribe.`,

  hotlineMessagesDisabled: isSubscriber =>
    isSubscriber
      ? 'Sorry, this channel does not have a hotline enabled. Send HELP to list valid commands.'
      : 'Sorry, this channel does not have a hotline enabled. Send HELP to list valid commands or HELLO to subscribe.',

  hotlineReplyOf: ({ messageId, reply }, memberType) => {
    const prefix =
      memberType === memberTypes.ADMIN ? prefixes.hotlineReplyTo(messageId) : prefixes.hotlineReply
    return `[${prefix}]\n${reply}`
  },

  inviteReceived: channelName =>
    `Hello! You have received an invite to join the [${channelName}] Signalboost channel. Please respond with ACCEPT or DECLINE.`,

  inviteAccepted: `Congrats! Someone has accepted your invite and is now a subscriber to this channel.`,

  promptToUseSignal:
    'This number only accepts messages sent with the Signal Private Messenger. Please install Signal from https://signal.org and try again.',

  rateLimitOccurred: (channelPhoneNumber, resendInterval) =>
    `Message rate limited on channel: ${channelPhoneNumber}.
    ${
      resendInterval
        ? `next resend attempt in: ${resendInterval.toString().slice(0, -3)} sec`
        : `message has exceeded resend threshold and will not be resent`
    }`,

  destroyChannelFailed: phoneNumber => `Failed to destroy channel for phone number: ${phoneNumber}`,

  restartRequesterNotAuthorized:
    'Trying to restart Signalboost? You are not authorized to do that!',
  restartChannelNotAuthorized:
    'Trying to restart Signalboost? You are using the wrong channel for that! Try again on the diagnostics channel.',
  restartPassNotAuthorized:
    'Trying to restart Signalboost? You used the wrong passphrase for that!',
  restartSuccessNotification: adminId => `Signalboost was restarted by ADMIN ${adminId}`,
  restartSuccessResponse: 'Signalboost was restarted successfully!',
  restartFailure: errorMessage => `Failed to restart Signalboost: ${errorMessage}`,

  safetyNumberChanged:
    'It looks like you safety number just changed. You might need to resend your last message! :)',

  toRemovedAdmin: adminId =>
    `ADMIN ${adminId} removed you as an admin from this channel. Send HELLO to resubscribe.`,

  toRemovedSubscriber:
    'You were just removed from this channel by an admin. Send HELLO to resubscribe.',

  toggles: {
    hotline: (isOn, adminId) => `ADMIN ${adminId} turned the hotline ${onOrOff(isOn)}.`,
  },

  vouchedInviteReceived: (channelName, invitesReceived, invitesNeeded) =>
    `Hello! You have received ${invitesReceived}/${invitesNeeded} invites to join the [${channelName}] Signalboost channel. ${
      invitesReceived === invitesNeeded ? 'Please respond with ACCEPT or DECLINE.' : ''
    }`,

  vouchModeChanged: commandResponses.vouchMode.success,

  vouchLevelChanged: (adminId, vouchLevel) =>
    `ADMIN ${adminId} set the vouching level to ${vouchLevel}. It will now require ${vouchLevel} ${
      vouchLevel > 1 ? 'invites' : 'invite'
    } to join this channel.`,

  welcome: (addingAdmin, channelPhoneNumber, channelName) =>
    `You were just made an admin of the Signalboost channel [${channelName}] by ${addingAdmin}. Welcome!

For easy access, add this phone number (${channelPhoneNumber}) to your contacts as [${channelName}]. People can subscribe to this channel by sending HELLO to ${channelPhoneNumber} and unsubscribe by sending GOODBYE.


To see a full list of commands, send HELP or check out our how-to guide: https://signalboost.info/how-to.`,
}

const prefixes = {
  broadcastMessage: `BROADCAST`,
  fromAdmin: 'FROM ADMIN',
  hotlineMessage: messageId => `HOTLINE FROM @${messageId}`,
  hotlineReply: `PRIVATE REPLY FROM ADMINS`,
  hotlineReplyTo: messageId => `REPLY TO @${messageId}`,
  notification: `NOTIFICATION`,
  privateMessage: `PRIVATE`,
}

module.exports = {
  commandResponses,
  parseErrors,
  notifications,
  prefixes,
  systemName,
}
