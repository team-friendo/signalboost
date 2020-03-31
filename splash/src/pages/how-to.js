import React from 'react'
import Layout from '../components/layout'
import { Link } from 'gatsby'

export default () => (
  <Layout>
    <p>
      This page is intended primarily for admins who already have Signalboost
      channels. If you need a channel, check out the{' '}
      <Link to="/">Getting Started</Link> section. If you want to know more
      about Signalboost and how secure it is to use, check out the{' '}
      <Link to="/faq">FAQ's.</Link>
    </p>
    <h3>Conceptual overview</h3>
    <p>
      A Signalboost channel is simply a phone number with admins and
      subscribers. Any time an admin sends a message to the channel, it is
      interpreted as a command or an announcement. If the message is an
      announcement, all of the subscribers will receive that announcement -
      notably, the announcement will appear as if it is coming from the channel
      phone number, not the admin who sent it.
    </p>
    <h3>What is a command?</h3>
    <p>
      A command is a word or phrase that Signalboost will interpret as an
      instruction. To use a command, you don't have to do anything fancy - just
      type it into the channel and Signalboost will interpret it or give you an
      error message! Some commands can only be used by admins. If you're unsure
      which command to use, the HELP command is a great place to start.
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
    </p>

    <h2>Commands</h2>
    <h4>HELP</h4>
    <p>Lists the possible commands you can use.</p>

    <h4>INFO</h4>
    <p>Shows stats and briefly explains how Signalboost works.</p>

    <h4>ADD / REMOVE +1-555-555-5555</h4>
    <p>
      Adds or removes +1-555-555-5555 as an admin of the channel. Any admins can
      remove or add any other admins.
    </p>

    <h4>INVITE +1-555-555-5555</h4>
    <p>
      Invites +1-555-555-5555 to subscribe to the channel. Remember to preface
      the phone number with a + and country code!
    </p>

    <h4>HOTLINE ON / OFF</h4>
    <p>
      Enables or disables the hotline. This means that when subscribers send
      messages to the channel, admins will receive them **anonymously.** By
      default, Signalboost channels start with the hotline disabled. If you're
      an admin, you'll know that a message coming in is a hotline message
      because it will have the following header:
    </p>
    <p>
      <b>[HOTLINE MESSAGE]</b>
    </p>
    <p>
      If you decide to turn the hotline on:
      <ul>
        <li>Your subscribers' anonymity will be preserved.</li>
        <li>
          This means that if you need to get in contact with someone from the
          hotline, they need to include their phone number in the message.
        </li>
        <li>
          Depending on the number of people subscribed to your channel, the
          hotline can be noisy and increase the chances of spam/abuse.
        </li>
      </ul>
    </p>

    <h4>ENGLISH / ESPAÑOL / FRANÇAIS / DEUTSCH </h4>
    <p>
      Switches language to Spanish or French. Language changes on Signalboost
      are person-specific, so you don't need to worry about
    </p>

    <h4>RENAME new name</h4>
    <p>Renames channel to "new name"</p>
    <p>Example: RENAME My Cool Signalboost Channel</p>

    <h4>DESCRIPTION description of channel</h4>
    <p>Adds or updates public description of channel.</p>
    <p>
      Example: DESCRIPTION This is the _super cool activist_ signalboost
      channel! We'll use it to make announcements for the upcoming protest.
    </p>

    <h4>VOUCHING ON / OFF</h4>
    <p>
      Turning vouching on means that only people who have received invites via
      the INVITE command can join the channel as subscribers. Invites are
      considered valid for vouched channels regardless of if you repeatedly
      toggle vouching on and off.
    </p>

    <h4>VOUCH LEVEL level</h4>
    <p>
      This changes the number of invites needed to join the channel; currently
      the vouch level must be between 1 and 10.
    </p>

    <p>Example: VOUCH LEVEL 3</p>
    <p>
      After executing this command, anyone who wants to join the channel will
      need 3 invites.
    </p>
    <h4>GOODBYE</h4>
    <p>
      Leaves the channel. If you're an admin, you will lose your admin access to
      the channel but will still be able to subscribe as a subscriber. If you
      want to obtain admin access again, you will need to ask a current admin to
      add you using the ADD command.
    </p>

    <h4>DESTROY</h4>
    <p>
      Danger zone! This command permanently destroys the channel and all
      associated records. Importantly, it does not erase the message history
      from admin and subscribers phones until the duration of the disappearing
      message timer is up.
    </p>
  </Layout>
)
