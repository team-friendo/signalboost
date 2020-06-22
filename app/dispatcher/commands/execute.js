const { commands, toggles, vouchModes } = require('./constants')
const { statuses } = require('../../util')
const messenger = require('../messenger')
const channelRepository = require('../../db/repositories/channel')
const membershipRepository = require('../../db/repositories/membership')
const inviteRepository = require('../../db/repositories/invite')
const deauthorizationRepository = require('../../db/repositories/deauthorization')
const hotlineMessageRepository = require('../../db/repositories/hotlineMessage')
const phoneNumberService = require('../../registrar/phoneNumber')
const signal = require('../../signal')
const logger = require('../logger')
const { defaultLanguage } = require('../../config')
const { get, isEmpty, uniq } = require('lodash')
const { getAllAdminsExcept, getAdminMemberships } = require('../../db/repositories/channel')
const { messagesIn } = require('../strings/messages')
const { memberTypes } = require('../../db/repositories/membership')
const { ADMIN, NONE } = memberTypes

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
 * type Toggle = toggles.HOTLINE
 **/

// (ExecutableOrParseError, Dispatchable) -> Promise<CommandResult>
const execute = async (executable, dispatchable) => {
  const { command, payload, language } = executable
  const { channel, sender, sdMessage } = dispatchable

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
    [commands.ACCEPT]: () => maybeAccept(channel, sender, language),
    [commands.ADD]: () => maybeAddAdmin(channel, sender, payload),
    [commands.DECLINE]: () => decline(channel, sender, language),
    [commands.DESTROY]: () => maybeConfirmDestroy(channel, sender),
    [commands.DESTROY_CONFIRM]: () => maybeDestroy(channel, sender),
    [commands.HELP]: () => showHelp(channel, sender),
    [commands.HOTLINE_ON]: () => maybeToggleSettingOn(channel, sender, toggles.HOTLINE),
    [commands.HOTLINE_OFF]: () => maybeToggleSettingOff(channel, sender, toggles.HOTLINE),
    [commands.INFO]: () => showInfo(channel, sender),
    [commands.INVITE]: () => maybeInvite(channel, sender, payload, language),
    [commands.JOIN]: () => maybeAddSubscriber(channel, sender, language),
    [commands.LEAVE]: () => maybeRemoveSender(channel, sender),
    [commands.PRIVATE]: () => maybePrivateMessageAdmins(channel, sender, payload, sdMessage),
    [commands.RENAME]: () => maybeRenameChannel(channel, sender, payload),
    [commands.REMOVE]: () => maybeRemoveMember(channel, sender, payload),
    [commands.REPLY]: () => maybeReplyToHotlineMessage(channel, sender, payload),
    [commands.VOUCHING_ON]: () => maybeSetVouchMode(channel, sender, vouchModes.ON),
    [commands.VOUCHING_OFF]: () => maybeSetVouchMode(channel, sender, vouchModes.OFF),
    [commands.VOUCHING_ADMIN]: () => maybeSetVouchMode(channel, sender, vouchModes.ADMIN),
    [commands.VOUCH_LEVEL]: () => maybeSetVouchLevel(channel, sender, payload),
    [commands.SET_LANGUAGE]: () => setLanguage(sender, language),
    [commands.SET_DESCRIPTION]: () => maybeSetDescription(channel, sender, payload),
  }[command] || (() => noop()))()

  result.notifications = result.notifications || []
  return { command, payload, ...result }
}

/********************
 * COMMAND EXECUTION
 ********************/

// ACCEPT

const maybeAccept = async (channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.accept

  try {
    // don't accept invite if sender is already a member
    if (await membershipRepository.isMember(channel.phoneNumber, sender.phoneNumber))
      return { status: statuses.ERROR, message: cr.alreadyMember }

    // don't accept invite if sender doesn't have sufficient invites
    const inviteCount = await inviteRepository.count(channel.phoneNumber, sender.phoneNumber)
    if (channel.vouchMode !== vouchModes.OFF && inviteCount < channel.vouchLevel)
      return {
        status: statuses.ERROR,
        message: cr.belowVouchLevel(channel, channel.vouchLevel, inviteCount),
      }

    // okay, fine: accept the invite! :)
    return accept(channel, sender, language, cr)
  } catch (e) {
    return { status: statuses.ERROR, message: cr.dbError }
  }
}

const accept = async (channel, sender, language, cr) =>
  inviteRepository
    .accept(channel.phoneNumber, sender.phoneNumber, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel) }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError }))

// ADD

const maybeAddAdmin = async (channel, sender, phoneNumber) => {
  const cr = messagesIn(sender.language).commandResponses.add
  if (sender.type !== ADMIN)
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
  return addAdmin(channel, sender, phoneNumber, cr)
}

const addAdmin = async (channel, sender, newAdminPhoneNumber, cr) => {
  try {
    const deauth = channel.deauthorizations.find(d => d.memberPhoneNumber === newAdminPhoneNumber)
    if (deauth) {
      await signal.trust(channel.phoneNumber, newAdminPhoneNumber, deauth.fingerprint)
      await deauthorizationRepository.destroy(channel.phoneNumber, newAdminPhoneNumber)
    }
    const newAdminMembership = await membershipRepository.addAdmin(
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

// PRIVATE
const maybePrivateMessageAdmins = async (channel, sender, payload, sdMessage) => {
  const cr = messagesIn(sender.language).commandResponses.private
  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }

  return Promise.all(
    getAdminMemberships(channel).map(admin => {
      return signal.sendMessage(
        admin.memberPhoneNumber,
        messenger.addHeader({
          channel,
          sdMessage: { ...sdMessage, messageBody: payload },
          messageType: messenger.messageTypes.PRIVATE_MESSAGE,
          language: admin.language,
          memberType: admin.type,
        }),
      )
    }),
  )
    .then(() => ({ status: statuses.SUCCESS }))
    .catch(() => ({ status: statuses.ERROR, message: cr.signalError }))
}

// DECLINE

const decline = async (channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.decline
  return inviteRepository
    .decline(channel.phoneNumber, sender.phoneNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError }))
}

// DESTROY

const maybeConfirmDestroy = async (channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.destroy

  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }
  return { status: statuses.SUCCESS, message: cr.confirm }
}

const maybeDestroy = async (channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.destroy

  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }

  const result = await phoneNumberService.destroy({
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

const showHelp = async (channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.help
  return {
    status: statuses.SUCCESS,
    message: sender.type === ADMIN ? cr.admin : cr.subscriber,
  }
}

// INFO

const showInfo = async (channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.info
  return { status: statuses.SUCCESS, message: cr[sender.type](channel) }
}

// INVITE

const maybeInvite = async (channel, sender, inviteePhoneNumbers, language) => {
  const cr = messagesIn(sender.language).commandResponses.invite
  if (sender.type === NONE) return { status: statuses.UNAUTHORIZED, message: cr.notSubscriber }
  if (sender.type !== ADMIN && channel.vouchMode === vouchModes.ADMIN)
    return { status: statuses.UNAUTHORIZED, message: cr.adminOnly }

  const inviteResults = await Promise.all(
    uniq(inviteePhoneNumbers).map(inviteePhoneNumber =>
      invite(channel, sender.phoneNumber, inviteePhoneNumber, language),
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

const invite = async (channel, inviterPhoneNumber, inviteePhoneNumber, language) => {
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

  if (await membershipRepository.isMember(channel.phoneNumber, inviteePhoneNumber)) {
    return { status: statuses.NOOP, notifications: [] }
  }

  try {
    const wasCreated = await issue(channel.phoneNumber, inviterPhoneNumber, inviteePhoneNumber)
    const totalReceived = await count(channel.phoneNumber, inviteePhoneNumber)

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
    channel.vouchMode !== vouchModes.OFF && channel.vouchLevel > 1
      ? notifications.vouchedInviteReceived(channel.name, invitesReceived, invitesNeeded)
      : notifications.inviteReceived(channel.name)

  return {
    recipient: inviteePhoneNumber,
    message: inviteMessage,
  }
}

// JOIN

const maybeAddSubscriber = async (channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.join
  if (sender.type !== NONE) return { status: statuses.ERROR, message: cr.alreadyMember }
  if (channel.vouchMode !== vouchModes.OFF)
    return { status: statuses.ERROR, message: cr.inviteRequired }
  return addSubscriber(channel, sender, language, cr)
}

const addSubscriber = (channel, sender, language, cr) =>
  membershipRepository
    .addSubscriber(channel.phoneNumber, sender.phoneNumber, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel) }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))

// LEAVE

const maybeRemoveSender = async (channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.leave
  return sender.type === NONE
    ? Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notSubscriber })
    : removeSender(channel, sender, cr)
}

const removeSender = (channel, sender, cr) => {
  const remove =
    sender.type === ADMIN ? membershipRepository.removeMember : membershipRepository.removeMember
  return remove(channel.phoneNumber, sender.phoneNumber)
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

const maybeRemoveMember = async (channel, sender, phoneNumber) => {
  const cr = messagesIn(sender.language).commandResponses.remove

  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }

  const payloadMemberType = await membershipRepository.resolveMemberType(
    channel.phoneNumber,
    phoneNumber,
  )
  return payloadMemberType === memberTypes.NONE
    ? { status: statuses.ERROR, message: cr.targetNotMember(phoneNumber) }
    : removeMember(channel, phoneNumber, payloadMemberType, sender, cr)
}

const removeMember = async (channel, memberPhoneNumber, memberType, sender, cr) => {
  const notifications =
    memberType === memberTypes.ADMIN
      ? removalNotificationsOfAdmin(channel, memberPhoneNumber, sender)
      : removalNotificationsOfSubscriber(channel, memberPhoneNumber, sender)
  return membershipRepository
    .removeMember(channel.phoneNumber, memberPhoneNumber)
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

const maybeRenameChannel = async (channel, sender, newChannelName) => {
  const cr = messagesIn(sender.language).commandResponses.rename
  return sender.type === ADMIN
    ? renameChannel(channel, newChannelName, sender, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
}

const renameChannel = (channel, newChannelName, sender, cr) =>
  channelRepository
    .update(channel.phoneNumber, { name: newChannelName })
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

const maybeReplyToHotlineMessage = (channel, sender, hotlineReply) => {
  const cr = messagesIn(sender.language).commandResponses.hotlineReply
  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }
  return replyToHotlineMessage(channel, sender, hotlineReply, cr)
}

const replyToHotlineMessage = async (channel, sender, hotlineReply, cr) => {
  try {
    const memberPhoneNumber = await hotlineMessageRepository.findMemberPhoneNumber({
      id: hotlineReply.messageId,
    })
    const language = get(
      await membershipRepository.findMembership(channel.phoneNumber, memberPhoneNumber),
      'language',
      defaultLanguage,
    )
    return {
      status: statuses.SUCCESS,
      message: cr.success(hotlineReply),
      notifications: hotlineReplyNotificationsOf(
        channel,
        sender,
        hotlineReply,
        memberPhoneNumber,
        language,
      ),
    }
  } catch (e) {
    return {
      status: statuses.ERROR,
      message: cr.invalidMessageId(hotlineReply.messageId),
    }
  }
}

const hotlineReplyNotificationsOf = (
  channel,
  sender,
  hotlineReply,
  memberPhoneNumber,
  language,
) => [
  {
    recipient: memberPhoneNumber,
    message: messagesIn(language).notifications.hotlineReplyOf(
      hotlineReply,
      memberTypes.SUBSCRIBER,
    ),
  },
  ...getAllAdminsExcept(channel, [sender.phoneNumber]).map(({ memberPhoneNumber, language }) => ({
    recipient: memberPhoneNumber,
    message: messagesIn(language).notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
  })),
]

// ON / OFF TOGGLES FOR RESPONSES

// (Database, Channel, Sender, Toggle) -> Promise<CommandResult>
const maybeToggleSettingOn = (channel, sender, toggle) =>
  _maybeToggleSetting(channel, sender, toggle, true)

// (Database, Channel, Sender, Toggle) -> Promise<CommandResult>
const maybeToggleSettingOff = (channel, sender, toggle) =>
  _maybeToggleSetting(channel, sender, toggle, false)

// (Database, Channel, Sender, Toggle, boolean) -> Promise<CommandResult>
const _maybeToggleSetting = (channel, sender, toggle, isOn) => {
  const cr = messagesIn(sender.language).commandResponses.toggles[toggle.name]
  if (sender.type !== ADMIN) {
    return Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
  }
  return _toggleSetting(channel, sender, toggle, isOn, cr)
}

// (Database, Channel, Sender, Toggle, boolean, object) -> Promise<CommandResult>
const _toggleSetting = (channel, sender, toggle, isOn, cr) =>
  channelRepository
    .update(channel.phoneNumber, { [toggle.dbField]: isOn })
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
    message: messagesIn(sender.language).notifications.toggles[toggle.name].success(isOn),
  }))
}

// SET_LANGUAGE

const setLanguage = (sender, language) => {
  const cr = messagesIn(language).commandResponses.setLanguage
  return membershipRepository
    .updateLanguage(sender.phoneNumber, language)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError }))
}

// SET_DESCRIPTION

const maybeSetDescription = async (channel, sender, newDescription) => {
  const cr = messagesIn(sender.language).commandResponses.description
  return sender.type === ADMIN
    ? setDescription(channel, newDescription, sender, cr)
    : Promise.resolve({ status: statuses.UNAUTHORIZED, message: cr.notAdmin })
}

const setDescription = (channel, newDescription, sender, cr) => {
  return channelRepository
    .update(channel.phoneNumber, { description: newDescription })
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

// VOUCH MODE
const maybeSetVouchMode = (channel, sender, newVouchMode) => {
  const cr = messagesIn(sender.language).commandResponses.vouchMode

  if (sender.type !== ADMIN)
    return {
      status: statuses.UNAUTHORIZED,
      message: cr.notAdmin,
    }

  return setVouchMode(channel, sender, newVouchMode, cr)
}

const setVouchMode = async (channel, sender, newVouchMode, cr) => {
  try {
    await channelRepository.update(channel.phoneNumber, {
      vouchMode: newVouchMode,
    })

    return {
      status: statuses.SUCCESS,
      message: cr.success(newVouchMode),
      notifications: vouchModeNotificationsOf(channel, sender, newVouchMode),
    }
  } catch (e) {
    logger.error(e)
    return { status: statuses.ERROR, message: cr.dbError }
  }
}

const vouchModeNotificationsOf = (channel, sender, newVouchMode) => {
  const bystanders = getAllAdminsExcept(channel, [sender.phoneNumber])

  return bystanders.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: messagesIn(membership.language).notifications.vouchModeChanged(newVouchMode),
  }))
}

// VOUCH LEVEL

const maybeSetVouchLevel = (channel, sender, newVouchLevel) => {
  const cr = messagesIn(sender.language).commandResponses.vouchLevel
  if (sender.type !== ADMIN)
    return {
      status: statuses.UNAUTHORIZED,
      message: cr.notAdmin,
    }

  return setVouchLevel(channel, newVouchLevel, sender, cr)
}

const setVouchLevel = async (channel, newVouchLevel, sender, cr) => {
  try {
    await channelRepository.update(channel.phoneNumber, {
      vouchLevel: newVouchLevel,
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
