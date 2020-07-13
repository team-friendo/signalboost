import React from 'react'
import Layout from '../components/layout'
import { Link } from 'gatsby'

export default () => (
  <Layout>
    <p>
      This page is intended primarily for admins who already have Signalboost
      channels. If you need a channel, check out the{' '}
      <Link to="/">Getting Started</Link> section. If you want to know more
      about why you should use Signalboost for your activist organizing work,
      check out our <Link to="/faq">FAQ's.</Link>
    </p>
    <h3>Conceptual overview</h3>
    <p>
      A Signalboost channel is a phone number that keeps track of admins and
      subscribers. Any time an admin sends a message to the channel, it is
      interpreted as a command or a broadcast. If admins send a broadcast, all
      of the subscribers will see it, but Signalboost will route the broadcast
      so that it appears as if coming from the channel phone number.
    </p>
    <h3>What is a command?</h3>
    <p>
      A command is a word or phrase sent as a Signal message that Signalboost
      will interpret as an instruction. Some commands can only be used by
      admins. If you're unsure which command to use, the HELP command is a great
      place to start.
    </p>
    <p>
      Signalboost currently supports English, Spanish, French, and German. To
      switch to your language of choice, type the name of the language into the
      channel. For example, if I want to switch my language to Spanish, I would
      send "ESPAÑOL" to the channel.
    </p>

    <h2>Disappearing Messages</h2>
    <p>
      By default, messages on Signalboost channels disappear after 1 week.
      However, admins and admins only can override the 1-week duration using the
      disappearing message timer in the top right hand corner of the Signal app.
      We recommend shortening the duration of disappearing message timer
      (usually to 1 day or 6 hours) if your broadcasts will contain sensitive
      information.
    </p>

    <h2>Commands</h2>
    <h4>HELP</h4>
    <p>Lists the possible commands you can use.</p>

    <h4>INFO</h4>
    <p>Shows stats and briefly explains how Signalboost works.</p>

    <h3>Managing your channel</h3>
    <h4 id="add-admin" class="anchor">
      ADD / REMOVE +1-555-555-5555
    </h4>
    <p>
      Adds or removes +1-555-555-5555 as an admin of the channel. Any admins can
      remove or add any other admins.
    </p>
    <h4 id="rename" class="anchor">
      RENAME new name
    </h4>
    <p>Renames channel to "new name"</p>
    <p>Example: RENAME My Cool Signalboost Channel</p>

    <h4 id="description" class="anchor">
      DESCRIPTION description of channel
    </h4>
    <p>Adds or updates public description of channel.</p>
    <p>
      Example: DESCRIPTION This is the _super cool activist_ signalboost
      channel! We'll use it to make announcements for the upcoming protest.
    </p>

    <h4 id="vouching" class="anchor">
      VOUCHING ON / OFF / ADMIN
    </h4>
    <p>
      VOUCHING ON: turning vouching on means that an invite (1 by default) is
      required to join the channel. Both admins and subscribers can invite
      people to the channel using the INVITE command.
    </p>
    <p>
      {' '}
      VOUCHING OFF: this is the default behavior of the channel; anyone can join
      by sending HELLO to the channel number.
    </p>
    <p>
      VOUCHING ADMIN: this means that an invite from an *admin* is required to
      join the channel. If other people try to send invites, they will be
      prevented from doing so.
    </p>
    <h4 id="invite" class="anchor">
      INVITE +1-555-555-5555
    </h4>
    <p>
      Invites +1-555-555-5555 to subscribe to the channel. Remember to preface
      the phone number with a + and country code!
    </p>
    <p>
      Multiple invites can be sent by listing phone numbers separated by commas:
    </p>
    <p>INVITE +1-555-555-5555, +1-333-333-3333</p>
    <h4 id="vouch-level" class="anchor">
      VOUCH LEVEL level
    </h4>
    <p>
      This changes the number of invites needed to join the channel; currently
      the vouch level must be between 1 and 10.
    </p>

    <p>Example: VOUCH LEVEL 3</p>
    <p>
      After executing this command, anyone who wants to join the channel will
      need 3 invites.
    </p>

    <h3>Managing a hotline</h3>
    <h4 id="hotline" class="anchor">
      HOTLINE ON / OFF
    </h4>
    <p>
      Enables or disables a hotline, which allows admins to receive anonymous
      messages from subscribers. Channel hotlines are off by default. If you're
      an admin, you'll know that a message coming in is a hotline message
      because it will have the following header:
    </p>
    <p>
      <b>[HOTLINE #3214]</b>
    </p>
    <p>
      If you decide to turn the hotline on:
      <ul>
        <li>
          Your subscribers' anonymity will be preserved when they message the
          hotline.
        </li>
        <li>
          Depending on the number of people subscribed to your channel, the
          hotline can be noisy and increase the chances of spam/abuse.
        </li>
      </ul>
    </p>
    <h4 id="hotline-replies" class="anchor">
      REPLY
    </h4>
    <p>Incoming hotline messages are followed by a hotline #:</p>
    <blockquote>
      <p>[HOTLINE #3214]</p>
      <p>Hello! We need a legal representative at jail support location XYZ.</p>
    </blockquote>
    <p>In order to respond to a hotline message, type REPLY:</p>
    <blockquote>
      <p>REPLY #3214 Okay, we are sending someone over!</p>
    </blockquote>
    <p>And the subscriber you replied to will receive the following message:</p>
    <blockquote>
      <p>[PRIVATE REPLY FROM ADMINS]</p>
      <p>Okay, we are sending someone over!</p>
    </blockquote>

    <h3>Other useful commands</h3>
    <h4 id="private-messages" class="anchor">
      PRIVATE good morning fellow admins!
    </h4>
    <p>
      Sends a private message to admins only (subscribers will not be able to
      see those messages).
    </p>
    <h4 id="languages" class="anchor">
      ENGLISH / ESPAÑOL / FRANÇAIS / DEUTSCH{' '}
    </h4>
    <p>
      Switches language to Spanish, French, or German. Language changes on
      Signalboost are user-specific, so if you change your language to Spanish
      other admins and subscribers' channels will be unaffected.
    </p>

    <h4 id="leave" class="anchor">
      GOODBYE
    </h4>
    <p>
      Leaves the channel. If you're an admin, you will lose your admin access to
      the channel but will still be able to subscribe as a subscriber. If you
      want to obtain admin access again, you will need to ask a current admin to
      add you using the ADD command.
    </p>

    <h4 id="destroy" class="anchor">
      DESTROY
    </h4>
    <p>
      Danger zone! This command permanently destroys the channel and all
      associated records. Importantly, it does not erase the message history
      from admin and subscribers phones until the duration of the disappearing
      message timer is up.
    </p>
  </Layout>
)
