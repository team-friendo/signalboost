const { commands, toggles, vouchModes } = require('./constants')
const { statuses } = require('../../util')
const channelRepository = require('../../db/repositories/channel')
const deauthorizationRepository = require('../../db/repositories/deauthorization')
const diagnostics = require('../../diagnostics')
const eventRepository = require('../../db/repositories/event')
const hotlineMessageRepository = require('../../db/repositories/hotlineMessage')
const banRepository = require('../../db/repositories/ban')
const inviteRepository = require('../../db/repositories/invite')
const membershipRepository = require('../../db/repositories/membership')
const phoneNumberRegistrar = require('../../registrar/phoneNumber')
const channelRegistrar = require('../../registrar/channel')
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
  signal: { diagnosticsPhoneNumber, supportPhoneNumber },
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
  commands.CHANNEL,
  commands.HELP,
  commands.INFO,
  commands.INVITE,
  commands.JOIN,
  commands.LEAVE,
  commands.REQUEST,
  commands.SET_LANGUAGE,
])

const supportOnlyCommands = new Set([commands.REQUEST, commands.CHANNEL])

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
    [commands.BAN]: () => maybeBanSender(channel, sender, payload),
    [commands.BROADCAST]: () => broadcastMessage(channel, sender, sdMessage, payload),
    [commands.CHANNEL]: () => maybeCreateChannel(sender, payload),
    [commands.DECLINE]: () => decline(channel, sender, language),
    [commands.DESTROY]: () => confirmDestroy(channel, sender),
    [commands.DESTROY_CONFIRM]: () => actuallyDestroy(channel, sender),
    [commands.HELP]: () => showHelp(channel, sender),
    [commands.HOTLINE_ON]: () => toggleSettingOn(channel, sender, toggles.HOTLINE),
    [commands.HOTLINE_OFF]: () => toggleSettingOff(channel, sender, toggles.HOTLINE),
    [commands.INFO]: () => showInfo(channel, sender),
    [commands.INVITE]: () => maybeInvite(channel, sender, payload, language),
    [commands.JOIN]: () => maybeAddSubscriber(channel, sender, language),
    [commands.LEAVE]: () => maybeRemoveSender(channel, sender),
    [commands.PRIVATE]: () => privateMessageAdmins(channel, sender, payload, sdMessage),
    [commands.REMOVE]: () => maybeRemoveMember(channel, sender, payload),
    [commands.REQUEST]: () => promptChannel(channel, sender),
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
  const supportCommandOnWrongChannel =
    supportOnlyCommands.has(command) && channel.phoneNumber !== supportPhoneNumber

  // return early if...
  // (1) admin sent a no-command message or support-channel-only-message to a non-support channel
  if (
    sender.type === memberTypes.ADMIN &&
    (command === commands.NONE || supportCommandOnWrongChannel)
  )
    return { ...defaultResult, message: messagesIn(sender.language).commandResponses.none.error }

  // (2) subscriber/rando sent a no-command message, an admin-only command, a no-payload command with a payload,
  // or a support-only command to a non-support channel
  if (
    sender.type !== ADMIN &&
    (type === parseErrorTypes.NON_EMPTY_PAYLOAD ||
      !validSubscriberCommands.has(command) ||
      supportCommandOnWrongChannel)
  )
    return { ...defaultResult, ...(await handleBadSubscriberMessage(channel, sender, sdMessage)) }

  // (3) anyone sent a valid command with an invalid payload (reported as a parse error)
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
    message: messagesIn(sender.language).notifications.hotlineMessageSent,
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
    if (await membershipRepository.isMember(channel.phoneNumber, sender.memberPhoneNumber))
      return { status: statuses.ERROR, message: cr.alreadyMember }

    // don't accept invite if sender doesn't have sufficient invites
    const inviteCount = await inviteRepository.count(channel.phoneNumber, sender.memberPhoneNumber)
    if (channel.vouchMode !== vouchModes.OFF && inviteCount < channel.vouchLevel)
      return {
        status: statuses.ERROR,
        message: cr.belowVouchLevel(channel.vouchLevel, inviteCount),
      }

    // okay, fine: accept the invite! :)
    return accept(channel, sender, language, cr)
  } catch (e) {
    return { status: statuses.ERROR, message: cr.dbError }
  }
}

const accept = async (channel, sender, language, cr) =>
  inviteRepository
    .accept(channel.phoneNumber, sender.memberPhoneNumber, language)
    .then(() => eventRepository.logIfFirstMembership(sender.memberPhoneNumber))
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
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
      message: cr.success(newAdminMembership),
      notifications: addAdminNotificationsOf(channel, newAdminMembership, sender),
    }
  } catch (e) {
    logger.error(e)
    return { status: statuses.ERROR, message: cr.dbError(newAdminPhoneNumber) }
  }
}

const addAdminNotificationsOf = (channel, newAdminMembership, sender) => {
  const newAdminPhoneNumber = newAdminMembership.memberPhoneNumber
  const bystanders = getAllAdminsExcept(channel, [sender.memberPhoneNumber])
  return [
    {
      recipient: newAdminPhoneNumber,
      message: `${messagesIn(newAdminMembership.language).notifications.welcome(
        sender.memberPhoneNumber,
        channel.phoneNumber,
      )}`,
    },
    ...bystanders.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message: appendHeaderToNotification(membership, 'adminAdded', [
        sender.adminId,
        newAdminMembership.adminId,
      ]),
    })),
  ]
}

// BAN
const maybeBanSender = async (channel, sender, hotlineMessage) => {
  const cr = messagesIn(sender.language).commandResponses.ban

  if (sender.type !== ADMIN) {
    return { status: statuses.UNAUTHORIZED, message: cr.notAdmin }
  }
  // check if hotlineMessage.messageId is a thing
  const memberPhoneNumber = await hotlineMessageRepository.findMemberPhoneNumber(
    hotlineMessage.messageId,
  )

  const isBanned = await banRepository.isBanned(memberPhoneNumber)
  return isBanned
    ? {
        status: statuses.ERROR,
        message: cr.alreadyBanned(hotlineMessage.messageId),
      }
    : banMember(channel.phoneNumber, memberPhoneNumber, hotlineMessage.messageId, cr)
}

const banMember = async (channelPhoneNumber, memberPhoneNumber, messageId, cr) => {
  return banRepository
    .banMember(channelPhoneNumber.phoneNumber, memberPhoneNumber)
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success(messageId),
    }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError }))
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

  const adminNotifications = adminMemberships.map(recipientMembership => ({
    recipient: recipientMembership.memberPhoneNumber,
    message: appendHeaderToRelayableMessage(
      sender,
      recipientMembership,
      'broadcastMessage',
      messageBody,
    ),
    attachments,
  }))

  const subscriberNotifications = subscriberMemberships.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: messageBody,
    attachments,
  }))

  return [...adminNotifications, ...subscriberNotifications]
}

// CHANNEL
const maybeCreateChannel = async (sender, payload) => {
  const cr = messagesIn(sender.language).commandResponses.channel
  try {
    const newChannel = await channelRegistrar.create(payload)
    if (newChannel.status === statuses.ERROR) {
      return {
        status: statuses.ERROR,
        payload: '',
        message: cr.requestsClosed,
      }
    }
    return {
      status: statuses.SUCCESS,
      payload: '',
      message: cr.success(newChannel.phoneNumber),
    }
  } catch (e) {
    logger.error(e)
    return { status: statuses.ERROR, payload: '', message: cr.error }
  }
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

  return adminMemberships.map(recipientMembership => ({
    recipient: recipientMembership.memberPhoneNumber,
    message: appendHeaderToRelayableMessage(sender, recipientMembership, 'privateMessage', payload),
    attachments: sdMessage.attachments,
  }))
}

// DECLINE

const decline = async (channel, sender, language) => {
  const cr = messagesIn(language).commandResponses.decline
  return inviteRepository
    .decline(channel.phoneNumber, sender.memberPhoneNumber)
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
    .catch(() => ({ status: statuses.ERROR, message: cr.dbError }))
}

// DESTROY

const confirmDestroy = async (channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.destroy
  return { status: statuses.SUCCESS, message: cr.confirm }
}

const actuallyDestroy = async (channel, sender) => {
  const cr = messagesIn(sender.language).commandResponses.destroy
  const result = await phoneNumberRegistrar.destroy({
    phoneNumber: channel.phoneNumber,
    sender,
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
      invite(channel, sender.memberPhoneNumber, inviteePhoneNumber, language),
    ),
  )

  // return an error status if ANY invites failed
  const errors = inviteResults.filter(ir => ir.status === statuses.ERROR)
  // but return notifications for all successful invites in all cases
  const notifications = inviteResults.map(ir => ir.notification).filter(Boolean)

  if (!isEmpty(errors)) {
    return {
      status: statuses.ERROR,
      message: cr.dbErrors(
        errors.map(e => e.inviteePhoneNumber),
        inviteResults.length,
      ),
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
      ? notifications.vouchedInviteReceived(invitesReceived, invitesNeeded)
      : notifications.inviteReceived

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
    .addSubscriber(channel.phoneNumber, sender.memberPhoneNumber, language)
    .then(() => eventRepository.logIfFirstMembership(sender.memberPhoneNumber))
    .then(() => ({ status: statuses.SUCCESS, message: cr.success }))
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
  return remove(channel.phoneNumber, sender.memberPhoneNumber)
    .then(() => eventRepository.logIfLastMembership(sender.memberPhoneNumber))
    .then(() => ({
      status: statuses.SUCCESS,
      message: cr.success,
      notifications: removeSenderNotificationsOf(channel, sender),
    }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.error }))
}

const removeSenderNotificationsOf = (channel, sender) => {
  if (sender.type !== ADMIN) return []
  const bystanders = getAllAdminsExcept(channel, [sender.memberPhoneNumber])
  return bystanders.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: appendHeaderToNotification(membership, 'adminLeft', [sender.adminId]),
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
  const bystanders = getAllAdminsExcept(channel, [sender.memberPhoneNumber, phoneNumber])

  return [
    {
      recipient: phoneNumber,
      message:
        memberType === memberTypes.ADMIN
          ? appendHeaderToNotification(removedMember, 'toRemovedAdmin', [sender.adminId])
          : messagesIn(removedMember.language).notifications.toRemovedSubscriber,
    },
    ...bystanders.map(membership => ({
      recipient: membership.memberPhoneNumber,
      message:
        memberType === memberTypes.ADMIN
          ? appendHeaderToNotification(membership, 'adminRemoved', [
              sender.adminId,
              removedMember.adminId,
            ])
          : appendHeaderToNotification(membership, 'subscriberRemoved', [sender.adminId]),
    })),
  ]
}

// REQUEST
const promptChannel = (channel, sender) => ({
  status: statuses.SUCCESS,
  message: messagesIn(sender.language).commandResponses.request.success,
})

// REPLY

// (Channel, Membership, SdMessage, HotlineReply) => Promise<CommandResult>
const replyToHotlineMessage = async (channel, sender, sdMessage, hotlineReply) => {
  const cr = messagesIn(sender.language).commandResponses.hotlineReply
  const { attachments } = sdMessage

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
  // response to hotline message sender
  {
    recipient: memberPhoneNumber,
    message: messagesIn(language).notifications.hotlineReplyOf(
      hotlineReply,
      memberTypes.SUBSCRIBER,
    ),
    attachments,
  },
  // notifications to all admins
  ...getAdminMemberships(channel, [sender.memberPhoneNumber]).map(recipientMembership => ({
    recipient: recipientMembership.memberPhoneNumber,
    message: appendHeaderToRelayableMessage(
      sender,
      recipientMembership,
      'hotlineReplyTo',
      hotlineReply.reply,
      hotlineReply.messageId,
    ),
    attachments,
  })),
]

// RESTART

const maybeRestart = async (channel, sender, payload) => {
  logger.log(`--- FULL MANUAL RESTART INITIATED by ${util.hash(sender.memberPhoneNumber)}...`)
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
    if (!(await channelRepository.isMaintainer(sender.memberPhoneNumber)))
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
}

const _restartNotificationsOf = async sender => {
  const maintainers = (await channelRepository.getMaintainers()).filter(
    m => m.memberPhoneNumber !== sender.memberPhoneNumber,
  )
  return maintainers.map(maintainer => ({
    recipient: maintainer.memberPhoneNumber,
    message: appendHeaderToNotification(maintainer, 'restartSuccessNotification', [sender.adminId]),
  }))
}

// SET_LANGUAGE

const setLanguage = (sender, language) => {
  const cr = messagesIn(language).commandResponses.setLanguage
  return membershipRepository
    .updateLanguage(sender.memberPhoneNumber, language)
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
      message: cr.success(isOn),
      notifications: toggleSettingNotificationsOf(channel, sender, toggle, isOn),
    }))
    .catch(err => logAndReturn(err, { status: statuses.ERROR, message: cr.dbError(isOn) }))
}

const toggleSettingNotificationsOf = (channel, sender, toggle, isOn) => {
  const recipients = getAllAdminsExcept(channel, [sender.memberPhoneNumber])
  return recipients.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: appendHeaderToNotification(membership, toggle.notificationKey, [isOn, sender.adminId]),
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
  const bystanders = getAllAdminsExcept(channel, [sender.memberPhoneNumber])

  return bystanders.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: appendHeaderToNotification(membership, 'vouchModeChanged', [
      newVouchMode,
      sender.adminId,
    ]),
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
  const bystanders = getAllAdminsExcept(channel, [sender.memberPhoneNumber])

  return bystanders.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: appendHeaderToNotification(membership, 'vouchLevelChanged', [
      sender.adminId,
      newVouchLevel,
    ]),
  }))
}

/**********
 * HELPERS
 **********/

const hotlineNotificationsOf = async (channel, sender, { messageBody, attachments }) => {
  const adminMemberships = await channelRepository.getAdminMemberships(channel)

  const messageId = await hotlineMessageRepository.getMessageId({
    channelPhoneNumber: channel.phoneNumber,
    memberPhoneNumber: sender.memberPhoneNumber,
  })

  const prefix = language => `[${messagesIn(language).prefixes.hotlineMessage(messageId)}]\n`

  return adminMemberships.map(membership => ({
    recipient: membership.memberPhoneNumber,
    message: `${prefix(membership.language)}${messageBody}`,
    attachments: attachments,
  }))
}

// (Membership, string, Array<string>) => string
const appendHeaderToNotification = (recipientMembership, notificationType, args) => {
  const header = `${messagesIn(recipientMembership.language).prefixes.notificationHeader}`
  const messageBody = messagesIn(recipientMembership.language).notifications[notificationType](
    ...args,
  )
  return `[${header}]\n${messageBody}`
}

// (Membership, Membership, string, string, number) => string
const appendHeaderToRelayableMessage = (
  senderMembership,
  recipientMembership,
  notificationType,
  messageBody,
  hotlineMessageId,
) => {
  const { fromAdmin } = messagesIn(recipientMembership.language).prefixes
  const notificationTypePrefix = messagesIn(recipientMembership.language).prefixes[notificationType]
  const _notificationType = hotlineMessageId
    ? notificationTypePrefix(hotlineMessageId)
    : notificationTypePrefix
  return `[${_notificationType} ${fromAdmin} ${senderMembership.adminId}]\n${messageBody}`
}

const logAndReturn = (err, statusTuple) => {
  // TODO(@zig): add prometheus error count here (counter: db_error)
  logger.error(err)
  return statusTuple
}

module.exports = { appendHeaderToRelayableMessage, appendHeaderToNotification, execute, toggles }
