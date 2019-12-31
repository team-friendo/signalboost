const { commands, statuses, toggles } = require('./constants')
const channelRepository = require('../../../db/repositories/channel')
const membershipRepository = require('../../../db/repositories/membership')
const inviteRepository = require('../../../db/repositories/invite')
const validator = require('../../../db/validations/phoneNumber')
const logger = require('../logger')
const { getAdminMemberships } = require('../../../db/repositories/channel')
const { messagesIn } = require('../strings/messages')
const { memberTypes } = require('../../../db/repositories/membership')
const { ADMIN, NONE } = memberTypes
const {
  signal: { signupPhoneNumber },
} = require('../../../config')

/**
 * type Executable = {
 *   command: string,
 *   payload: string,
 *   language: 'EN' | 'ES'
 * }
 *
 * type CommandResult = {
 *   command: string,
 *   status: string,
 *   message: string,
 *   notifications: Array<{ recipient: Array<string>, message: string }>
 * }
 *
 * type Toggle = toggles.RESPONSES | toggles.VOUCHING
 * */

// (Executable, Dispatchable) -> Promise<CommandResult>
const execute = async (executable, dispatchable) => {
  const { command, payload, language } = executable
  const { db, channel, sender } = dispatchable
  // don't allow command execution on the signup channel for non-admins
  if (channel.phoneNumber === signupPhoneNumber && sender.type !== ADMIN) return noop()
  const result = await ({
    [commands.ACCEPT]: () => maybeAccept(db, channel, sender, language),
    [commands.ADD]: () => maybeAddAdmin(db, channel, sender, payload),
    [commands.DECLINE]: () => decline(db, channel, sender, language),
    [commands.HELP]: () => showHelp(db, channel, sender),
    [commands.INFO]: () => showInfo(db, channel, sender),
    [commands.INVITE]: () => maybeInvite(db, channel, sender, payload),
    [commands.JOIN]: () => maybeAddSubscriber(db, channel, sender, language),
    [commands.LEAVE]: () => maybeRemoveSender(db, channel, sender),
    [commands.RENAME]: () => maybeRenameChannel(db, channel, sender, payload),
    [commands.REMOVE]: () => maybeRemoveAdmin(db, channel, sender, payload),
    [commands.RESPONSES_ON]: () => maybeToggleSettingOn(db, channel, sender, toggles.RESPONSES),
    [commands.RESPONSES_OFF]: () => maybeToggleSettingOff(db, channel, sender, toggles.RESPONSES),
    [commands.VOUCHING_ON]: () => maybeToggleSettingOn(db, channel, sender, toggles.VOUCHING),
    [commands.VOUCHING_OFF]: () => maybeToggleSettingOff(db, channel, sender, toggles.VOUCHING),
    [commands.SET_LANGUAGE]: () => setLanguage(db, sender, language),
  }[command] || (() => noop()))()
  return { command, ...result }
}

/********************
 * COMMAND EXECUTION
 ********************/

// ACCEPT

const maybeAccept = async (db, channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.accept
  const THRESHOLD = 1 // TODO read threshold from channel when playing #137
  try {
    // don't accept invite if sender is already a member
    if (await membershipRepository.isMember(db, channel.phoneNumber, sender.phoneNumber))
      return { status: statuses.ERROR, message: cr.alreadyMember }

    // don't accept invite if sender does not have enough invites to pass vouch threshold
    const inviteCount = await inviteRepository.count(db, channel.phoneNumber, sender.phoneNumber)
    if (channel.vouchingOn && inviteCount < THRESHOLD)
      return { status: statuses.ERROR, message: cr.belowThreshold(channel, THRESHOLD, inviteCount) }

    // okay, fine: accept the invite! :)
    return accept(db, channel, sender, language, cr)
  } catch (e) {
    return { status: statuses.ERROR, message: cr.dbError }
  }
}

const accept = async (db, channel, sender, language, cr) =>
  inviteRepository
    .accept(db, channel.phoneNumber, sender.phoneNumber, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel) }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError }))

// DECLINE

const decline = async (db, channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.decline
  return inviteRepository
    .decline(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError }))
}

// ADD

const maybeAddAdmin = async (db, channel, sender, phoneNumberInput) => {
  const cr = messagesIn(sender.language).commandResponses.add
  if (!(sender.type === ADMIN)) {
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
  }
  const { isValid, phoneNumber } = validator.parseValidPhoneNumber(phoneNumberInput)
  if (!isValid) return { status: statuses.ERROR, message: cr.invalidNumber(phoneNumberInput) }
  return addAdmin(db, channel, sender, phoneNumber, cr)
}

const addAdmin = async (db, channel, sender, newAdminPhoneNumber, cr) => {
  try {
    const newAdminMembership = await membershipRepository.addAdmin(
      db,
      channel.phoneNumber,
      newAdminPhoneNumber,
    )
    return {
      status: statuses.SUCCESS,
      message: cr.success(newAdminPhoneNumber),
      notifications: addAdminNotificationsOf(channel, newAdminMembership, sender),
    }
  } catch (e) {
    logger.error(e)
    return { status: statuses.ERROR, message: cr.dbError(newAdminPhoneNumber) }
  }
}

const addAdminNotificationsOf = (channel, newAdminMembership, sender) => {
  const allMemberships = getAdminMemberships(channel)
  const newAdminPhoneNumber = newAdminMembership.memberPhoneNumber
  const bystanderMemberships = allMemberships.filter(
    m => m.memberPhoneNumber !== sender.phoneNumber,
  )
  return [
    {
      recipient: newAdminPhoneNumber,
      message: `${messagesIn(newAdminMembership.language).notifications.welcome(
        sender.phoneNumber,
        channel.phoneNumber,
      )}`,
    },
    ...bystanderMemberships.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: messagesIn(membership.language).notifications.adminAdded,
    })),
  ]
}
// HELP

const showHelp = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.help
  return {
    status: statuses.SUCCESS,
    message: sender.type === ADMIN ? cr.admin : cr.subscriber,
  }
}

// INFO

const showInfo = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.info
  return { status: statuses.SUCCESS, message: cr[sender.type](channel) }
}

// INVITE

const maybeInvite = async (db, channel, sender, rawInviteePhoneNumber) => {
  const cr = messagesIn(sender.language).commandResponses.invite

  if (sender.type === NONE) return { status: statuses.UNAUTHORIZED, message: cr.unauthorized }
  const { isValid, phoneNumber } = validator.parseValidPhoneNumber(rawInviteePhoneNumber)
  if (!isValid) return { status: statuses.ERROR, message: cr.invalidNumber(rawInviteePhoneNumber) }
  if (await membershipRepository.isMember(db, channel.phoneNumber, phoneNumber)) {
    // We don't return an "already member" error message here to defend side-channel attacks on membership lists.
    // But we *do* return an error status so messenger won't send out an invite notification!
    return { status: statuses.ERROR, message: cr.success }
  }

  return invite(db, channel, sender.phoneNumber, phoneNumber, cr)
}

const invite = async (db, channel, inviterPhoneNumber, inviteePhoneNumber, cr) => {
  try {
    const inviteWasCreated = await inviteRepository.issue(
      db,
      channel.phoneNumber,
      inviterPhoneNumber,
      inviteePhoneNumber,
    )
    // We don't return an "already invited" error here to defend side-channel attacks (as above)
    return inviteWasCreated
      ? {
          status: statuses.SUCCESS,
          message: cr.success,
          notifications: inviteNotificationsOf(channel, inviteePhoneNumber),
        }
      : { status: statuses.ERROR, message: cr.success }
  } catch (e) {
    return { status: statuses.ERROR, message: cr.dbError }
  }
}

const inviteNotificationsOf = (channel, inviteePhoneNumber) => {
  return [
    {
      recipient: inviteePhoneNumber,
      message: messagesIn(channel.language).notifications.inviteReceived(channel.name),
    },
  ]
}

// JOIN

const maybeAddSubscriber = async (db, channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.join
  if (sender.type !== NONE) return { status: statuses.ERROR, message: cr.alreadyMember }
  if (channel.vouchingOn) return { status: statuses.ERROR, message: cr.inviteRequired }
  return addSubscriber(db, channel, sender, language, cr)
}

const addSubscriber = (db, channel, sender, language, cr) =>
  membershipRepository
    .addSubscriber(db, channel.phoneNumber, sender.phoneNumber, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel) }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))

// LEAVE

const maybeRemoveSender = async (db, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.leave
  return sender.type === NONE
    ? Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notSubscriber })
    : removeSender(db, channel, sender, cr)
}

const removeSender = (db, channel, sender, cr) => {
  const remove =
    sender.type === ADMIN ? membershipRepository.removeAdmin : membershipRepository.removeSubscriber
  return remove(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success,
      // TODO NITPICK(aguestuser|2019-12-30): we could tuck this ternary into `removeSenderNotificationsOf`?
      //  since `sender` is an argument to that function, we can easily check `sender.type` there, and it makes
      //  this bit a bit less noisy. (by "pushing the complexity down")
      notifications: sender.type === ADMIN ? removeSenderNotificationsOf(channel, sender) : [],
    }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))
}

const removeSenderNotificationsOf = (channel, sender) => {
  const allMemberships = getAdminMemberships(channel)
  const bystanderMemberships = allMemberships.filter(
    m => m.memberPhoneNumber !== sender.phoneNumber,
  )
  return [
    ...bystanderMemberships.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: messagesIn(membership.language).notifications.adminLeft,
    })),
  ]
}

// REMOVE

const maybeRemoveAdmin = async (db, channel, sender, adminPhoneNumber) => {
  const cr = messagesIn(sender.language).commandResponses.remove
  const { isValid, phoneNumber: validAdminNumber } = validator.parseValidPhoneNumber(
    adminPhoneNumber,
  )

  if (!(sender.type === ADMIN)) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }
  if (!isValid) {
    return { status: statuses.ERROR, message: cr.invalidNumber(adminPhoneNumber) }
  }
  if (!(await membershipRepository.isAdmin(db, channel.phoneNumber, validAdminNumber)))
    return { status: statuses.ERROR, message: cr.targetNotAdmin(validAdminNumber) }

  return removeAdmin(db, channel, validAdminNumber, sender, cr)
}

const removeAdmin = async (db, channel, adminPhoneNumber, sender, cr) => {
  return membershipRepository
    .removeAdmin(db, channel.phoneNumber, adminPhoneNumber)
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(adminPhoneNumber),
      notifications: removalNotificationsOf(channel, adminPhoneNumber, sender),
    }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError(adminPhoneNumber) }))
}

const removalNotificationsOf = (channel, adminPhoneNumber, sender) => {
  const allMemberships = getAdminMemberships(channel)
  const removedMembership = allMemberships.find(m => m.memberPhoneNumber === adminPhoneNumber)
  const bystanderMemberships = allMemberships.filter(
    m => m.memberPhoneNumber !== sender.phoneNumber && m.memberPhoneNumber !== adminPhoneNumber,
  )
  return [
    {
      recipient: adminPhoneNumber,
      message: `${messagesIn(removedMembership.language).notifications.toRemovedAdmin}`,
    },
    ...bystanderMemberships.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: messagesIn(membership.language).notifications.adminRemoved,
    })),
  ]
}

// RENAME

const maybeRenameChannel = async (db, channel, sender, newChannelName) => {
  const cr = messagesIn(sender.language).commandResponses.rename
  return sender.type === ADMIN
    ? renameChannel(db, channel, newChannelName, sender, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
}

const renameChannel = (db, channel, newChannelName, sender, cr) =>
  channelRepository
    .update(db, channel.phoneNumber, { name: newChannelName })
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(channel.name, newChannelName),
      notifications: renameNotificationsOf(channel, newChannelName, sender),
    }))
    .catch(err =>
      logAndReturn(err, {
        status: statuses.ERROR,
        message: cr.dbError(channel.name, newChannelName),
      }),
    )

const renameNotificationsOf = (channel, newChannelName, sender) => {
  const allMemberships = getAdminMemberships(channel)
  const bystanderMemberships = allMemberships.filter(
    m => m.memberPhoneNumber !== sender.phoneNumber,
  )
  return [
    ...bystanderMemberships.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: messagesIn(sender.language).notifications.channelRenamed(
        channel.name,
        newChannelName,
      ),
    })),
  ]
}

// ON / OFF TOGGLES FOR RESPONSES, VOUCHING

// (Database, Channel, Sender, Toggle) -> Promise<CommandResult>
const maybeToggleSettingOn = (db, channel, sender, toggle) =>
  _maybeToggleSetting(db, channel, sender, toggle, true)

// (Database, Channel, Sender, Toggle) -> Promise<CommandResult>
const maybeToggleSettingOff = (db, channel, sender, toggle) =>
  _maybeToggleSetting(db, channel, sender, toggle, false)

// (Database, Channel, Sender, Toggle, boolean) -> Promise<CommandResult>
const _maybeToggleSetting = (db, channel, sender, toggle, isOn) => {
  const cr = messagesIn(sender.language).commandResponses.toggles[toggle.name]
  if (!(sender.type === ADMIN)) {
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
  }
  return _toggleSetting(db, channel, sender, toggle, isOn, cr)
}

// (Database, Channel, Sender, Toggle, boolean, object) -> Promise<CommandResult>
const _toggleSetting = (db, channel, sender, toggle, isOn, cr) =>
  channelRepository
    .update(db, channel.phoneNumber, { [toggle.dbField]: isOn })
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(isOn),
      notifications: toggleSettingNotificationsOf(channel, sender, toggle, isOn),
    }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError(isOn) }))

const toggleSettingNotificationsOf = (channel, sender, toggle, isOn) => {
  // TODO(aguestuser|2019-12-30):
  //  - we repeat this `allMemberships` -> `bystanderMemberships` bit quite a lot (4 times?)
  //  - seems like an argument for a `getBystanderMemberships(channel, sender)` helper in `repositories/memberhip`?
  const allMemberships = getAdminMemberships(channel)
  const bystanderMemberships = allMemberships.filter(
    m => m.memberPhoneNumber !== sender.phoneNumber,
  )
  const notificationMsg = messagesIn(sender.language).notifications.toggles[toggle.name].success(
    isOn,
  )
  return [
    ...bystanderMemberships.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: notificationMsg,
    })),
  ]
}

// SET_LANGUAGE

const setLanguage = (db, sender, language) => {
  const cr = messagesIn(language).commandResponses.setLanguage
  return membershipRepository
    .updateLanguage(db, sender.phoneNumber, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError }))
}

// NOOP
const noop = () => Promise.resolve({ command: commands.NOOP, status: statuses.NOOP, message: '' })

/**********
 * HELPERS
 **********/

const logAndReturn = (err, statusTuple) => {
  // TODO(@zig): add prometheus error count here (counter: db_error)
  logger.error(err)
  return statusTuple
}

module.exports = { execute, toggles }
