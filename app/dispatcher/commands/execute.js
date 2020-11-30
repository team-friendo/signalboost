const { commands, toggles, vouchModes } = require('./constants')
const { statuses } = require('../../util')
const channelRepository = require('../../db/repositories/channel')
const deauthorizationRepository = require('../../db/repositories/deauthorization')
const diagnostics = require('../../diagnostics')
const eventRepository = require('../../db/repositories/event')
const hotlineMessageRepository = require('../../db/repositories/hotlineMessage')
const inviteRepository = require('../../db/repositories/invite')
const membershipRepository = require('../../db/repositories/membership')
const phoneNumberService = require('../../registrar/phoneNumber')
const signal = require('../../signal')
const logger = require('../logger')
const util = require('../../util')
const { parseErrorTypes } = require('./constants')
const { get, isEmpty, uniq } = require('lodash')
const { messagesIn } = require('../strings/messages')
const { memberTypes } = require('../../db/repositories/membership')
const { ADMIN, SUBSCRIBER, NONE } = memberTypes
const {
  getAllAdminsExcept,
  getAdminMemberships,
  getSubscriberMemberships,
} = require('../../db/repositories/channel')
const {
  defaultLanguage,
  auth: { maintainerPassphrase },
  signal: { diagnosticsPhoneNumber },
} = require('../../config')

/**
 *
 * type CommandResult = {
 *   command: string,
 *   payload: string,
 *   status: string,
 *   message: string,
 *   notifications: Array<{ recipient: string, message: string, attachments: Array<signal.OutboundSignaldAttachment> }>
 *
 * type Toggle = toggles.HOTLINE
 **/

const validSubscriberCommands = new Set([
  commands.ACCEPT,
  commands.DECLINE,
  commands.HELP,
  commands.INFO,
  commands.INVITE,
  commands.JOIN,
  commands.LEAVE,
  commands.SET_LANGUAGE,
])

// (ExecutableOrParseError, Dispatchable) -> Promise<CommandResult>
const execute = async (executable, dispatchable) => {
  const intervention = await interveneIfBadMessage(executable, dispatchable)
  if (intervention) return intervention

  const { command, payload, language } = executable
  const { channel, sender, sdMessage } = dispatchable

  // otherwise, dispatch on the command issued, and process it!
  const result = await {
    [commands.ACCEPT]: () => maybeAccept(channel, sender, language),
    [commands.ADD]: () => addAdmin(channel, sender, payload),
    [commands.BROADCAST]: () => broadcastMessage(channel, sender, sdMessage, payload),
    [commands.DECLINE]: () => decline(channel, sender, language),
    [commands.DESTROY]: () => confirmDestroy(channel, sender),
    [commands.DESTROY_CONFIRM]: () => destroy(channel, sender),
    [commands.HELP]: () => showHelp(channel, sender),
    [commands.HOTLINE_ON]: () => toggleSettingOn(channel, sender, toggles.HOTLINE),
    [commands.HOTLINE_OFF]: () => toggleSettingOff(channel, sender, toggles.HOTLINE),
    [commands.INFO]: () => showInfo(channel, sender),
    [commands.INVITE]: () => maybeInvite(channel, sender, payload, language),
    [commands.JOIN]: () => maybeAddSubscriber(channel, sender, language),
    [commands.LEAVE]: () => maybeRemoveSender(channel, sender),
    [commands.PRIVATE]: () => privateMessageAdmins(channel, sender, payload, sdMessage),
    [commands.REMOVE]: () => maybeRemoveMember(channel, sender, payload),
    [commands.REPLY]: () => replyToHotlineMessage(channel, sender, sdMessage, payload),
    [commands.RESTART]: () => maybeRestart(channel, sender, payload),
    [commands.VOUCHING_ON]: () => setVouchMode(channel, sender, vouchModes.ON),
    [commands.VOUCHING_OFF]: () => setVouchMode(channel, sender, vouchModes.OFF),
    [commands.VOUCHING_ADMIN]: () => setVouchMode(channel, sender, vouchModes.ADMIN),
    [commands.VOUCH_LEVEL]: () => setVouchLevel(channel, sender, payload),
    [commands.SET_LANGUAGE]: () => setLanguage(sender, language),
  }[command]()

  result.notifications = result.notifications || []
  return { command, payload, ...result }
}

// (Executable, Dispatchable) => Promise<CommandResult | null>
const interveneIfBadMessage = async (executable, dispatchable) => {
  const { command, error, type } = executable
  const { channel, sender, sdMessage } = dispatchable
  const defaultResult = { command, status: statuses.ERROR, payload: '', notifications: [] }

  // return early if...
  // admin sent a no-command message
  if (command === commands.NONE && sender.type === memberTypes.ADMIN)
    return { ...defaultResult, message: messagesIn(sender.language).commandResponses.none.error }

  // subscriber/rando sent a no-command message, an admin-only command, or a no-payload command with a payload
  if (
    sender.type !== ADMIN &&
    (type === parseErrorTypes.NON_EMPTY_PAYLOAD || !validSubscriberCommands.has(command))
  )
    return { ...defaultResult, ...(await handleBadSubscriberMessage(channel, sender, sdMessage)) }

  // anyone sent a valid command with an invalid payload (reported as a parse error)
  if (error) return { ...defaultResult, message: error }

  // if all is good, proceed!
  return null
}

// (Channel, Sender, SdMessage) => Promise<CommandResult>
const handleBadSubscriberMessage = async (channel, sender, sdMessage) => {
  // if hotline is off, return a generic error
  if (!channel.hotlineOn) {
    return {
      command: commands.NONE,
      message: messagesIn(sender.language).notifications.hotlineMessagesDisabled(
        sender.type === SUBSCRIBER,
      ),
      status: statuses.ERROR,
      notifications: [],
    }
  }
  // if hotline is on, handle as a hotline message
  return {
    command: commands.NONE,
    message: messagesIn(sender.language).notifications.hotlineMessageSent(channel),
    status: statuses.SUCCESS,
    notifications: await hotlineNotificationsOf(channel, sender, sdMessage),
  }
}

/********************
 * COMMAND EXECUTION
 ********************/

// ACCEPT

const maybeAccept = async (channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.accept

  try {
    // don't accept if channel has reached its subscriber limit
    if (!channelRepository.canAddSubscribers(channel))
      return {
        status: statuses.ERROR,
        message: cr.subscriberLimitReached(channel.subscriberLimit),
      }

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
    .then(() => eventRepository.logIfFirstMembership(sender.phoneNumber))
    .then(() => ({ status: statuses.SUCCESS, message: cr.success(channel) }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError }))

// ADD

const addAdmin = async (channel, sender, newAdminPhoneNumber) => {
  const cr = messagesIn(sender.language).commandResponses.add
  try {
    const deauth = channel.deauthorizations.find(d => d.memberPhoneNumber === newAdminPhoneNumber)
    if (deauth) {
      const { phoneNumber, socketId } = channel
      await signal.trust(phoneNumber, newAdminPhoneNumber, deauth.fingerprint, socketId)
      await deauthorizationRepository.destroy(phoneNumber, newAdminPhoneNumber)
    }
    const newAdminMembership = await membershipRepository.addAdmin(
      channel.phoneNumber,
      newAdminPhoneNumber,
    )
    await eventRepository.logIfFirstMembership(newAdminPhoneNumber)
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

// BROADCAST
const broadcastMessage = (channel, sender, sdMessage, payload) => {
  return {
    status: statuses.SUCCESS,
    message: '',
    notifications: broadcastNotificationsOf(channel, sender, sdMessage, payload),
  }
}

const broadcastNotificationsOf = (channel, sender, { attachments }, messageBody) => {
  const adminMemberships = getAdminMemberships(channel)
  const subscriberMemberships = getSubscriberMemberships(channel)

  const adminMessagePrefix = language => messagesIn(language).prefixes.broadcastMessage
  const adminNotifications = adminMemberships.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: `[${adminMessagePrefix(membership.language)}]\n${messageBody}`,
    attachments,
  }))

  const subscriberNotifications = subscriberMemberships.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: `[${channel.name}]\n${messageBody}`,
    attachments,
  }))

  return [...adminNotifications, ...subscriberNotifications]
}

// PRIVATE
const privateMessageAdmins = async (channel, sender, payload, sdMessage) => {
  const cr = messagesIn(sender.language).commandResponses.private
  try {
    return {
      status: statuses.SUCCESS,
      notifications: privateMessageNotificationsOf(channel, sender, payload, sdMessage),
    }
  } catch (e) {
    return { status: statuses.ERROR, message: cr.signalError }
  }
}

const privateMessageNotificationsOf = (channel, sender, payload, sdMessage) => {
  const adminMemberships = getAdminMemberships(channel)
  const prefix = language => messagesIn(language).prefixes.privateMessage

  return adminMemberships.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: `[${prefix(membership.language)}]\n${payload}`,
    attachments: sdMessage.attachments,
  }))
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

const confirmDestroy = async (channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.destroy
  return { status: statuses.SUCCESS, message: cr.confirm }
}

const destroy = async (channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.destroy
  const result = await phoneNumberService.destroy({
    phoneNumber: channel.phoneNumber,
    sender: sender.phoneNumber,
    notifyOnFailure: true,
  })
  if (get(result, 'status') === statuses.SUCCESS) {
    return { status: statuses.SUCCESS, message: cr.success }
  } else {
    return { status: statuses.ERROR, message: cr.error }
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

  if (!channelRepository.canAddSubscribers(channel, inviteePhoneNumbers.length))
    return {
      status: statuses.ERROR,
      message: cr.subscriberLimitReached(
        inviteePhoneNumbers.length,
        channel.subscriberLimit,
        getSubscriberMemberships(channel).length,
      ),
    }
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
  if (!channelRepository.canAddSubscribers(channel))
    return {
      status: statuses.ERROR,
      message: cr.subscriberLimitReached(channel.subscriberLimit),
    }
  if (sender.type !== NONE) return { status: statuses.ERROR, message: cr.alreadyMember }
  if (channel.vouchMode !== vouchModes.OFF)
    return { status: statuses.ERROR, message: cr.inviteRequired }
  return addSubscriber(channel, sender, language, cr)
}

const addSubscriber = (channel, sender, language, cr) =>
  membershipRepository
    .addSubscriber(channel.phoneNumber, sender.phoneNumber, language)
    .then(() => eventRepository.logIfFirstMembership(sender.phoneNumber))
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
    .then(() => eventRepository.logIfLastMembership(sender.phoneNumber))
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
  const payloadMemberType = await membershipRepository.resolveMemberType(
    channel.phoneNumber,
    phoneNumber,
  )
  return payloadMemberType === memberTypes.NONE
    ? { status: statuses.ERROR, message: cr.targetNotMember(phoneNumber) }
    : removeMember(channel, phoneNumber, payloadMemberType, sender, cr)
}

const removeMember = async (channel, memberPhoneNumber, memberType, sender, cr) => {
  const notifications = removalNotificationsOf(channel, memberPhoneNumber, sender, memberType)
  return membershipRepository
    .removeMember(channel.phoneNumber, memberPhoneNumber)
    .then(() => eventRepository.logIfLastMembership(memberPhoneNumber))
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(memberPhoneNumber),
      notifications,
    }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError(memberPhoneNumber) }))
}

const removalNotificationsOf = (channel, phoneNumber, sender, memberType) => {
  const removedMember = channel.memberships.find(m => m.memberPhoneNumber === phoneNumber)
  const bystanders = getAllAdminsExcept(channel, [sender.phoneNumber, phoneNumber])
  const responseKey = memberType === memberTypes.ADMIN ? 'toRemovedAdmin' : 'toRemovedSubscriber'
  const notificationKey = memberType === memberTypes.ADMIN ? 'adminRemoved' : 'subscriberRemoved'
  return [
    {
      recipient: phoneNumber,
      message: `${messagesIn(removedMember.language).notifications[responseKey]}`,
    },
    ...bystanders.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: messagesIn(membership.language).notifications[notificationKey],
    })),
  ]
}

// REPLY

const replyToHotlineMessage = async (channel, sender, { attachments }, hotlineReply) => {
  const cr = messagesIn(sender.language).commandResponses.hotlineReply
  try {
    const memberPhoneNumber = await hotlineMessageRepository.findMemberPhoneNumber(
      hotlineReply.messageId,
    )
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
        attachments,
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
  attachments,
) => [
  {
    recipient: memberPhoneNumber,
    message: messagesIn(language).notifications.hotlineReplyOf(
      hotlineReply,
      memberTypes.SUBSCRIBER,
    ),
    attachments,
  },
  ...getAdminMemberships(channel, [sender.phoneNumber]).map(({ memberPhoneNumber, language }) => ({
    recipient: memberPhoneNumber,
    message: messagesIn(language).notifications.hotlineReplyOf(hotlineReply, memberTypes.ADMIN),
    attachments,
  })),
]

// RESTART

const maybeRestart = async (channel, sender, payload) => {
  logger.log(`--- FULL MANUAL RESTART INITIATED by ${util.hash(sender.phoneNumber)}...`)
  try {
    // authenticate user and password:
    const { isAuthorized, message } = await _authenticateRestart(channel, sender, payload)
    if (!isAuthorized) {
      logger.log(`--- MANUAL RESTART UNAUTHORIZED: ${message}`)
      return { status: statuses.UNAUTHORIZED, message }
    }
    // do the restarting:
    await diagnostics.restartAll()
    logger.log('--- FULL MANUAL RESTART SUCCEEDED')

    return {
      status: statuses.SUCCESS,
      message: messagesIn(sender.language).notifications.restartSuccessResponse,
      notifications: await _restartNotificationsOf(sender),
    }
  } catch (err) {
    logger.error({ ...err, message: `--- RESTART FAILED: ${err.message || err}` })
    return {
      status: statuses.ERROR,
      message: messagesIn(sender.language).notifications.restartFailure(err.message || err),
    }
  }
}

// (Channel, Sender, string) => Promise<{isAuthorized: boolen, message: string}>
const _authenticateRestart = async (channel, sender, payload) => {
  // make sure that restart requester is the right person on the right channel with the right passphrase
  // before allowing restart to proceed
  const n = messagesIn(sender.language).notifications
  try {
    if (!(await channelRepository.isMaintainer(sender.phoneNumber)))
      return { isAuthorized: false, message: n.restartRequesterNotAuthorized }
    if (channel.phoneNumber !== diagnosticsPhoneNumber)
      return { isAuthorized: false, message: n.restartChannelNotAuthorized }
    if (payload !== maintainerPassphrase)
      return { isAuthorized: false, message: n.restartPassNotAuthorized }
    // yay! all systems go!
    return { isAuthorized: true, message: '' }
  } catch (e) {
    return { isAuthorized: false, message: e.message }
  }

  //messagesIn(sender.language).notifications.restartRequesterNotAuthorized,
}

const _restartNotificationsOf = async sender => {
  const maintainers = (await channelRepository.getMaintainers()).filter(
    m => m.memberPhoneNumber !== sender.phoneNumber,
  )
  return maintainers.map(maintainer => ({
    recipient: maintainer.memberPhoneNumber,
    // TODO(aguestuser|2020-10-07): replace `sender.phoneNumber` here with an adminId once those exist! :)
    message: messagesIn(maintainer.language).notifications.restartSuccessNotification(
      sender.phoneNumber,
    ),
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

// TOGGLES FOR SET COMMANDS RESPONSES

// (Database, Channel, Sender, Toggle) -> Promise<CommandResult>
const toggleSettingOn = (channel, sender, toggle) => _toggleSetting(channel, sender, toggle, true)

// (Database, Channel, Sender, Toggle) -> Promise<CommandResult>
const toggleSettingOff = (channel, sender, toggle) => _toggleSetting(channel, sender, toggle, false)

// (Database, Channel, Sender, Toggle, boolean, object) -> Promise<CommandResult>
const _toggleSetting = (channel, sender, toggle, isOn) => {
  const cr = messagesIn(sender.language).commandResponses.toggles[toggle.name]
  return channelRepository
    .update(channel.phoneNumber, { [toggle.dbField]: isOn })
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(isOn, channel.vouchLevel),
      notifications: toggleSettingNotificationsOf(channel, sender, toggle, isOn),
    }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError(isOn) }))
}

const toggleSettingNotificationsOf = (channel, sender, toggle, isOn) => {
  const recipients = getAllAdminsExcept(channel, [sender.phoneNumber])
  return recipients.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: messagesIn(sender.language).notifications.toggles[toggle.name].success(isOn),
  }))
}

// VOUCH MODE
const setVouchMode = async (channel, sender, newVouchMode) => {
  const cr = messagesIn(sender.language).commandResponses.vouchMode
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

const setVouchLevel = async (channel, sender, newVouchLevel) => {
  const cr = messagesIn(sender.language).commandResponses.vouchLevel
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

// HELPERS

const hotlineNotificationsOf = async (channel, sender, { messageBody, attachments }) => {
  const adminMemberships = await channelRepository.getAdminMemberships(channel)

  const messageId = await hotlineMessageRepository.getMessageId({
    channelPhoneNumber: channel.phoneNumber,
    memberPhoneNumber: sender.phoneNumber,
  })

  const prefix = language => `[${messagesIn(language).prefixes.hotlineMessage(messageId)}]\n`

  return adminMemberships.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: `${prefix(membership.language)}${messageBody}`,
    attachments: attachments,
  }))
}

/**********
 * HELPERS
 **********/
const logAndReturn = (err, statusTuple) => {
  // TODO(@zig): add prometheus error count here (counter: db_error)
  logger.error(err)
  return statusTuple
}

module.exports = { execute, toggles }
