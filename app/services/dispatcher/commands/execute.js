const { commands, toggles } = require('./constants')
const { statuses } = require('../../../services/util')
const messenger = require('../messenger')
const channelRepository = require('../../../db/repositories/channel')
const membershipRepository = require('../../../db/repositories/membership')
const inviteRepository = require('../../../db/repositories/invite')
const deauthorizationRepository = require('../../../db/repositories/deauthorization')
const hotlineMessageRepository = require('../../../db/repositories/hotlineMessage')
const phoneNumberService = require('../../../../app/services/registrar/phoneNumber')
const signal = require('../../signal')
const logger = require('../logger')
const { get, isEmpty, uniq } = require('lodash')
const { getAllAdminsExcept, getAdminMemberships } = require('../../../db/repositories/channel')
const { messagesIn } = require('../strings/messages')
const { memberTypes } = require('../../../db/repositories/membership')
const { ADMIN, NONE } = memberTypes
const {
  signal: { signupPhoneNumber },
} = require('../../../config')

/**
 *
 * type CommandResult = {
 *   command: string,
 *   payload: string,
 *   status: string,
 *   message: string,
 *   notifications: Array<{ recipient: Array<string>, message: string }>
 * }
 *
 * type Toggle = toggles.HOTLINE | toggles.VOUCHING
 **/

// (ExecutableOrParseError, Dispatchable) -> Promise<CommandResult>
const execute = async (executable, dispatchable) => {
  const { command, payload, language } = executable
  const { db, sock, channel, sender, sdMessage } = dispatchable

  // don't allow ANY command execution on the signup channel for non-admins
  if (channel.phoneNumber === signupPhoneNumber && sender.type !== ADMIN) return noop()

  // if payload parse error occured return early and notify sender
  if (executable.error) {
    // sorry for this gross special casing! working fast during a mass mobilization! -aguestuser
    const message =
      command === commands.REPLY && sender.type !== memberTypes.ADMIN
        ? messagesIn(sender.language).commandResponses.hotlineReply.notAdmin
        : executable.error
    return {
      command,
      payload,
      status: statuses.ERROR,
      message,
      notifications: [],
    }
  }

  // otherwise, dispatch on the command issued, and process it!
  const result = await ({
    [commands.ACCEPT]: () => maybeAccept(db, channel, sender, language),
    [commands.ADD]: () => maybeAddAdmin(db, sock, channel, sender, payload),
    [commands.DECLINE]: () => decline(db, channel, sender, language),
    [commands.DESTROY]: () => maybeConfirmDestroy(db, sock, channel, sender),
    [commands.DESTROY_CONFIRM]: () => maybeDestroy(db, sock, channel, sender),
    [commands.HELP]: () => showHelp(db, channel, sender),
    [commands.HOTLINE_ON]: () => maybeToggleSettingOn(db, channel, sender, toggles.HOTLINE),
    [commands.HOTLINE_OFF]: () => maybeToggleSettingOff(db, channel, sender, toggles.HOTLINE),
    [commands.INFO]: () => showInfo(db, channel, sender),
    [commands.INVITE]: () => maybeInvite(db, channel, sender, payload, language),
    [commands.JOIN]: () => maybeAddSubscriber(db, channel, sender, language),
    [commands.LEAVE]: () => maybeRemoveSender(db, channel, sender),
    [commands.PRIVATE]: () => maybePrivateMessageAdmins(db, sock, channel, sender, payload, sdMessage),
    [commands.RENAME]: () => maybeRenameChannel(db, channel, sender, payload),
    [commands.REMOVE]: () => maybeRemoveMember(db, channel, sender, payload),
    [commands.REPLY]: () => maybeReplyToHotlineMessage(db, channel, sender, payload),
    [commands.VOUCHING_ON]: () => maybeToggleSettingOn(db, channel, sender, toggles.VOUCHING),
    [commands.VOUCHING_OFF]: () => maybeToggleSettingOff(db, channel, sender, toggles.VOUCHING),
    [commands.VOUCH_LEVEL]: () => maybeSetVouchLevel(db, channel, sender, payload),
    [commands.SET_LANGUAGE]: () => setLanguage(db, sender, language),
    [commands.SET_DESCRIPTION]: () => maybeSetDescription(db, channel, sender, payload),
  }[command] || (() => noop()))()

  result.notifications = result.notifications || []
  return { command, payload, ...result }
}

/********************
 * COMMAND EXECUTION
 ********************/

// ACCEPT

const maybeAccept = async (db, channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.accept

  try {
    // don't accept invite if sender is already a member
    if (await membershipRepository.isMember(db, channel.phoneNumber, sender.phoneNumber))
      return { status: statuses.ERROR, message: cr.alreadyMember }

    // don't accept invite if sender doesn't have sufficient invites
    const inviteCount = await inviteRepository.count(db, channel.phoneNumber, sender.phoneNumber)
    if (channel.vouchingOn && inviteCount < channel.vouchLevel)
      return {
        status: statuses.ERROR,
        message: cr.belowVouchLevel(channel, channel.vouchLevel, inviteCount),
      }

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

// ADD

const maybeAddAdmin = async (db, sock, channel, sender, phoneNumber) => {
  const cr = messagesIn(sender.language).commandResponses.add
  if (sender.type !== ADMIN)
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
  return addAdmin(db, sock, channel, sender, phoneNumber, cr)
}

const addAdmin = async (db, sock, channel, sender, newAdminPhoneNumber, cr) => {
  try {
    const deauth = channel.deauthorizations.find(d => d.memberPhoneNumber === newAdminPhoneNumber)
    if (deauth) {
      await signal.trust(sock, channel.phoneNumber, newAdminPhoneNumber, deauth.fingerprint)
      await deauthorizationRepository.destroy(db, channel.phoneNumber, newAdminPhoneNumber)
    }
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
  const newAdminPhoneNumber = newAdminMembership.memberPhoneNumber
  const bystanders = getAllAdminsExcept(channel, [sender.phoneNumber])
  return [
    {
      recipient: newAdminPhoneNumber,
      message: `${messagesIn(newAdminMembership.language).notifications.welcome(
        sender.phoneNumber,
        channel.phoneNumber,
        channel.name,
      )}`,
    },
    ...bystanders.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: messagesIn(membership.language).notifications.adminAdded,
    })),
  ]
}

// ADMINS
const maybePrivateMessageAdmins = async (db, sock, channel, sender, payload, sdMessage) => {
  const cr = messagesIn(sender.language).commandResponses.private
  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }

  return Promise.all(
    getAdminMemberships(channel).map(admin => {
      return signal.sendMessage(
        sock,
        admin.memberPhoneNumber,
        messenger.addHeader({
          channel,
          sdMessage: { ...sdMessage, messageBody: payload },
          messageType: messenger.messageTypes.PRIVATE_MESSAGE,
          language: admin.language,
          memberType: admin.type
        })
      )
    })
  )
    .then(() => ({ status: statuses.SUCCESS }))
    .catch(() => ({ status: statuses.ERROR, message: cr.signalError }))
}

// DECLINE

const decline = async (db, channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.decline
  return inviteRepository
    .decline(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError }))
}

// DESTROY

const maybeConfirmDestroy = async (db, sock, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.destroy

  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }
  return { status: statuses.SUCCESS, message: cr.confirm }
}

const maybeDestroy = async (db, sock, channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.destroy

  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }

  const result = await phoneNumberService.destroy({
    db,
    sock,
    phoneNumber: channel.phoneNumber,
    sender: sender.phoneNumber,
  })

  if (get(result, 'status') === statuses.SUCCESS) {
    return {
      status: statuses.SUCCESS,
      message: cr.success,
    }
  } else {
    return {
      status: statuses.ERROR,
      message: cr.error,
    }
  }
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

const maybeInvite = async (db, channel, sender, inviteePhoneNumbers, language) => {
  const cr = messagesIn(sender.language).commandResponses.invite
  if (sender.type === NONE) return { status: statuses.UNAUTHORIZED, message: cr.unauthorized }

  const inviteResults = await Promise.all(
    uniq(inviteePhoneNumbers).map(inviteePhoneNumber =>
      invite(db, channel, sender.phoneNumber, inviteePhoneNumber, language),
    ),
  )

  // return an error status if ANY invites failed
  const errors = inviteResults.filter(ir => ir.status === statuses.ERROR)
  // but return notifications for all successful invites in all cases
  const notifications = inviteResults.map(ir => ir.notification).filter(Boolean)

  if (!isEmpty(errors)) {
    return {
      status: statuses.ERROR,
      message: cr.dbErrors(errors.map(e => e.inviteePhoneNumber), inviteResults.length),
      notifications,
    }
  }

  return { status: statuses.SUCCESS, message: cr.success(inviteResults.length), notifications }
}

const invite = async (db, channel, inviterPhoneNumber, inviteePhoneNumber, language) => {
  // SECURITY NOTE:
  //
  // There are 2 cases in which inviting might fail due to a logical error:
  // (1) invitee is already a member
  // (2) invitee has already been invited but not yet accepted
  //
  // In both cases, we might reasonably return an "already member" or "already invited"
  // error to the invite issuer. However, this would leak information about who is already
  // subscribed (or likely to soon subscribe to the channel), which would allow an attacker
  // with a list of targeted numbers to mount a side-channel attack that would allow them to
  // guess which numbers are subscribers by attempting to invite them all and seeing which ones
  // were already subscribed or invited.
  //
  // To avoid this attack, we simply report "invite issued" in all cases but DB write errors.

  const { issue, count } = inviteRepository

  if (await membershipRepository.isMember(db, channel.phoneNumber, inviteePhoneNumber)) {
    return { status: statuses.NOOP, notifications: [] }
  }

  try {
    const wasCreated = await issue(db, channel.phoneNumber, inviterPhoneNumber, inviteePhoneNumber)
    const totalReceived = await count(db, channel.phoneNumber, inviteePhoneNumber)

    return !wasCreated
      ? { status: statuses.NOOP, notifications: [] }
      : {
          status: statuses.SUCCESS,
          notification: inviteNotificationOf(
            channel,
            inviteePhoneNumber,
            totalReceived,
            channel.vouchLevel,
            language,
          ),
        }
  } catch (e) {
    return { status: statuses.ERROR, inviteePhoneNumber }
  }
}

const inviteNotificationOf = (
  channel,
  inviteePhoneNumber,
  invitesReceived,
  invitesNeeded,
  language,
) => {
  const notifications = messagesIn(language).notifications
  const inviteMessage =
    channel.vouchingOn && channel.vouchLevel > 1
      ? notifications.vouchedInviteReceived(channel.name, invitesReceived, invitesNeeded)
      : notifications.inviteReceived(channel.name)

  return {
    recipient: inviteePhoneNumber,
    message: inviteMessage,
  }
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
    sender.type === ADMIN ? membershipRepository.removeMember : membershipRepository.removeMember
  return remove(db, channel.phoneNumber, sender.phoneNumber)
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success,
      notifications: removeSenderNotificationsOf(channel, sender),
    }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))
}

const removeSenderNotificationsOf = (channel, sender) => {
  if (sender.type !== ADMIN) return []
  const bystanders = getAllAdminsExcept(channel, [sender.phoneNumber])
  return bystanders.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: messagesIn(membership.language).notifications.adminLeft,
  }))
}

// REMOVE

const maybeRemoveMember = async (db, channel, sender, phoneNumber) => {
  const cr = messagesIn(sender.language).commandResponses.remove

  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }

  const payloadMemberType = await membershipRepository.resolveMemberType(
    db,
    channel.phoneNumber,
    phoneNumber,
  )
  return payloadMemberType === memberTypes.NONE
    ? { status: statuses.ERROR, message: cr.targetNotMember(phoneNumber) }
    : removeMember(db, channel, phoneNumber, payloadMemberType, sender, cr)
}

const removeMember = async (db, channel, memberPhoneNumber, memberType, sender, cr) => {
  const notifications =
    memberType === memberTypes.ADMIN
      ? removalNotificationsOfAdmin(channel, memberPhoneNumber, sender)
      : removalNotificationsOfSubscriber(channel, memberPhoneNumber, sender)
  return membershipRepository
    .removeMember(db, channel.phoneNumber, memberPhoneNumber)
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(memberPhoneNumber),
      notifications,
    }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError(memberPhoneNumber) }))
}

const removalNotificationsOfAdmin = (channel, adminPhoneNumber, sender) => {
  const removedMember = channel.memberships.find(m => m.memberPhoneNumber === adminPhoneNumber)
  const bystanders = getAllAdminsExcept(channel, [sender.phoneNumber, adminPhoneNumber])
  return [
    {
      recipient: adminPhoneNumber,
      message: `${messagesIn(removedMember.language).notifications.toRemovedAdmin}`,
    },
    ...bystanders.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: messagesIn(membership.language).notifications.adminRemoved,
    })),
  ]
}

const removalNotificationsOfSubscriber = (channel, phoneNumber, sender) => {
  const removedMember = channel.memberships.find(m => m.memberPhoneNumber === phoneNumber)
  const bystanders = getAllAdminsExcept(channel, [sender.phoneNumber, phoneNumber])
  return [
    {
      recipient: phoneNumber,
      message: `${messagesIn(removedMember.language).notifications.toRemovedSubscriber}`,
    },
    ...bystanders.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: messagesIn(membership.language).notifications.subscriberRemoved,
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
  const bystanders = getAllAdminsExcept(channel, [sender.phoneNumber])
  return bystanders.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: messagesIn(sender.language).notifications.channelRenamed(channel.name, newChannelName),
  }))
}

// REPLY

const maybeReplyToHotlineMessage = (db, channel, sender, hotlineReply) => {
  const cr = messagesIn(sender.language).commandResponses.hotlineReply
  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }
  return replyToHotlineMessage(db, channel, sender, hotlineReply, cr)
}

const replyToHotlineMessage = async (db, channel, sender, hotlineReply, cr) => {
  try {
    const memberPhoneNumber = await hotlineMessageRepository.findMemberPhoneNumber({
      db,
      id: hotlineReply.messageId,
    })
    const membership = await membershipRepository.findMembership(
      db,
      channel.phoneNumber,
      memberPhoneNumber,
    )
    return {
      status: statuses.SUCCESS,
      message: cr.success(hotlineReply),
      notifications: hotlineReplyNotificationsOf(channel, sender, hotlineReply, membership),
    }
  } catch (e) {
    return {
      status: statuses.ERROR,
      message: cr.invalidMessageId(hotlineReply.messageId),
    }
  }
}

const hotlineReplyNotificationsOf = (channel, sender, hotlineReply, membership) => [
  {
    recipient: membership.memberPhoneNumber,
    message: messagesIn(membership.language).notifications.hotlineReplyOf(
      hotlineReply,
      memberTypes.SUBSCRIBER,
    ),
  },
  ...getAllAdminsExcept(channel, [sender.phoneNumber]).map(({ memberPhoneNumber, language }) => ({
    recipient: memberPhoneNumber,
    message: messagesIn(language).notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
  })),
]

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
  if (sender.type !== ADMIN) {
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
      message: cr.success(isOn, channel.vouchLevel),
      notifications: toggleSettingNotificationsOf(channel, sender, toggle, isOn),
    }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError(isOn) }))

const toggleSettingNotificationsOf = (channel, sender, toggle, isOn) => {
  const recipients = getAllAdminsExcept(channel, [sender.phoneNumber])
  return recipients.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: messagesIn(sender.language).notifications.toggles[toggle.name].success(
      isOn,
      channel.vouchLevel,
    ),
  }))
}

// SET_LANGUAGE

const setLanguage = (db, sender, language) => {
  const cr = messagesIn(language).commandResponses.setLanguage
  return membershipRepository
    .updateLanguage(db, sender.phoneNumber, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError }))
}

// SET_DESCRIPTION

const maybeSetDescription = async (db, channel, sender, newDescription) => {
  const cr = messagesIn(sender.language).commandResponses.description
  return sender.type === ADMIN
    ? setDescription(db, channel, newDescription, sender, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
}

const setDescription = (db, channel, newDescription, sender, cr) => {
  return channelRepository
    .update(db, channel.phoneNumber, { description: newDescription })
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(newDescription),
      notifications: descriptionNotificationsOf(channel, newDescription, sender),
    }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError }))
}

const descriptionNotificationsOf = (channel, newDescription, sender) => {
  const bystanders = getAllAdminsExcept(channel, [sender.phoneNumber])
  return bystanders.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: messagesIn(sender.language).notifications.setDescription(newDescription),
  }))
}

// VOUCH LEVEL

const maybeSetVouchLevel = (db, channel, sender, newVouchLevel) => {
  const cr = messagesIn(sender.language).commandResponses.vouchLevel
  if (sender.type !== ADMIN)
    return {
      status: statuses.UNAUTHORIZED,
      message: cr.notAdmin,
    }

  return setVouchLevel(db, channel, newVouchLevel, sender, cr)
}

const setVouchLevel = async (db, channel, newVouchLevel, sender, cr) => {
  try {
    await channelRepository.update(db, channel.phoneNumber, {
      vouchLevel: newVouchLevel,
      vouchingOn: true,
    })

    return {
      status: statuses.SUCCESS,
      message: cr.success(newVouchLevel),
      notifications: vouchLevelNotificationsOf(channel, newVouchLevel, sender),
    }
  } catch (e) {
    logger.error(e)
    return { status: statuses.ERROR, message: cr.dbError }
  }
}

const vouchLevelNotificationsOf = (channel, newVouchLevel, sender) => {
  const bystanders = getAllAdminsExcept(channel, [sender.phoneNumber])

  return bystanders.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: messagesIn(membership.language).notifications.vouchLevelChanged(newVouchLevel),
  }))
}

// NOOP
const noop = () =>
  Promise.resolve({ command: commands.NOOP, status: statuses.NOOP, message: '', notifications: [] })

/**********
 * HELPERS
 **********/

const logAndReturn = (err, statusTuple) => {
  // TODO(@zig): add prometheus error count here (counter: db_error)
  logger.error(err)
  return statusTuple
}

module.exports = { execute, toggles }
