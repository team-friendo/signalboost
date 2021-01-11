import { Link } from 'gatsby'
import React from 'react'
import Layout from '../components/layout'

export default () => (
  <Layout>
    <h2 id="getting-started" className="anchor">
      Getting Started
    </h2>
    <h3 className="getting-started-header">
      1.{' '}
      <a className="download-signal-link" href="https://signal.org/download/">
        Download Signal
      </a>
    </h3>
    <h3 className="getting-started-header anchor">
      2. Subscribe to the Signalboost Announcements and Helpline channel
    </h3>
    <p>
      Send <span className="command">HELLO</span> to{' '}
      <span className="purple">+1-947-800-5717</span> (that's 947-BOOST-IT!){' '}
    </p>
    <p>
      Send <span className="command">INFO</span> to see details about the
      channel.
    </p>{' '}
    <p>
      Send <span className="command">HELP</span> to see the other commands you
      can use.
    </p>
    <h3 className="getting-started-header">3. Request your own channel:</h3>
    <p>
      Send a Signal message to <span className="purple">+1-947-800-5717</span>{' '}
      that includes a comma-separated list of the phone numbers of at least 2
      admins. For example:
    </p>
    <blockquote className="command blockquote-skinny">
      <p>+1-123-555-5555, +1-123-555-5555</p>
    </blockquote>
    <p>
      You will receive a welcome message from your new channel phone number as
      soon as your channel is created.
    </p>
    <h3 className="getting-started-header">
      4. Send announcements or receive hotline messages
    </h3>
    <p>
      Now, any anyone who sends "HELLO" to your channel number will get
      announcements you send out!
    </p>
    <p>
      You can publish your channel phone number on Instagram or keep it to a
      close circle.
    </p>
    <h2>Signalboost Guide</h2>
    <h3>Disappearing Messages</h3>
    <p>
      By default, messages on Signalboost channels disappear after 1 week.
      However, admins and admins only can override the 1-week duration using the
      disappearing message timer in the top right hand corner of the Signal app.
      We recommend shortening the duration of disappearing message timer
      (usually to 1 day or 6 hours) if your broadcasts will contain sensitive
      information.
    </p>
    <h3>Language support</h3>
    <p>
      Signalboost currently supports{' '}
      <span className="purple">English, Spanish, French, and German</span>. To
      switch to your language of choice, type the name of the language into the
      channel. For example, if I want to switch my language to Spanish, I would
      send "ESPAÑOL" to the channel.
    </p>
    <h2>Commands</h2>
    <h3>How do I get people to join my channel?</h3>
    <p>
      Here's a{' '}
      <a href="https://www.instagram.com/p/CB31ULDDIjP/">short video</a> of how
      to get people to subscribe to updates from your channel. They can send{' '}
      <span className="command">HELLO</span> to your channel phone number or you
      can <Link to="/how-to#invite">invite them.</Link>
    </p>
    <h3>How do I broadcast a message?</h3>
    <p>
      If you're an admin, use the <span className="command">BROADCAST</span>{' '}
      command or the <span className="command">!</span> shortcut to broadcast a
      message to all the members of a channel:
    </p>
    <p>
      <blockquote className="command blockquote">
        BROADCAST Hello everyone! Community Meeting at 6pm this evening.
      </blockquote>
      <blockquote className="command blockquote">
        ! Hello everyone! Community Meeting at 6pm this evening.
      </blockquote>
    </p>
    <p>
      Here's a{' '}
      <a href="https://www.instagram.com/p/CB4RjYBjp7i/">short video</a> of what
      that looks like.
    </p>
    <h3 id="hotline-replies" className="anchor">
      How do I respond to a hotline message?
    </h3>
    <p>Incoming hotline messages are followed by an @id:</p>
    <blockquote className="command blockquote">
      <p>
        [HOTLINE @3214] <br />
        Hello! We need a legal representative at jail support location XYZ.
      </p>
    </blockquote>
    <p>
      In order to respond privately to that person, type @ followed by the id:
    </p>
    <blockquote className="command blockquote">
      <p>@3214 Okay, we are sending someone over!</p>
    </blockquote>
    <p>And the subscriber you replied to will receive the following message:</p>
    <blockquote className="command blockquote">
      <p>
        [PRIVATE REPLY FROM ADMINS]
        <br />
        Okay, we are sending someone over!
      </p>
    </blockquote>
    <h3>How can I see a list of commands I can use?</h3>
    <p>
      <span className="command">HELP</span> lists the possible commands you can
      use.
    </p>
    <h3>How can I see how many people are subscribed to my channel?</h3>
    <p>
      <span className="command">INFO</span> shows stats and briefly explains how
      Signalboost works.
    </p>
    <h3>Managing your channel</h3>
    <h4 id="add-admin" className="anchor">
      ADD / REMOVE +1-555-555-5555
    </h4>
    <p>
      Adds or removes +1-555-555-5555 as an admin of the channel. Any admins can
      remove or add any other admins.
    </p>
    <h4 id="vouching" className="anchor">
      VOUCHING ON / OFF / ADMIN
    </h4>
    <p>
      <span className="command">VOUCHING ON</span>: turning vouching on means
      that an invite (1 by default) is required to join the channel. Both admins
      and subscribers can invite people to the channel using the INVITE command.
    </p>
    <p>
      {' '}
      <span className="command">VOUCHING OFF</span>: this is the default
      behavior of the channel; anyone can join by sending HELLO to the channel
      number.
    </p>
    <p>
      <span className="command">VOUCHING ADMIN</span>: this means that an invite
      from an *admin* is required to join the channel. If other people try to
      send invites, they will be prevented from doing so.
    </p>
    <h4 id="invite" className="anchor">
      INVITE +1-555-555-5555
    </h4>
    <p>
      Invites +1-555-555-5555 to subscribe to the channel. Remember to preface
      the phone number with a + and country code!
    </p>
    <p>
      Multiple invites can be sent by listing phone numbers separated by commas:
    </p>
    <p>
      <blockquote className="command blockquote">
        INVITE +1-555-555-5555, +1-333-333-3333
      </blockquote>
    </p>
    <h4 id="vouch-level" className="anchor">
      VOUCH LEVEL level
    </h4>
    <p>
      This changes the number of invites needed to join the channel. For
      example:
    </p>
    <p>
      <blockquote className="command blockquote">VOUCH LEVEL 3</blockquote>
    </p>
    <p>
      After executing this command, anyone who wants to join the channel will
      need 3 invites.
    </p>
    <h3>Managing a hotline</h3>
    <h4 id="hotline" className="anchor">
      HOTLINE ON / OFF
    </h4>
    <p>
      Enables or disables a hotline, which allows admins to receive anonymous
      messages from subscribers. Channel hotlines are off by default. If you're
      an admin, you'll know that a message coming in is a hotline message
      because it will have the following header:
    </p>
    <p>
      <blockquote className="command blockquote">[HOTLINE #3214]</blockquote>
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
    <h3>Other useful commands</h3>
    <h4 id="private-messages" className="anchor">
      PRIVATE good morning fellow admins!
    </h4>
    <p>
      Sends a private message to admins only (subscribers will not be able to
      see those messages).
    </p>
    <p>For a shortcut, use the "~" symbol instead:</p>
    <blockquote className="command blockquote">
      <p>~ good morning fellow admins!</p>
    </blockquote>
    <h4 id="languages" className="anchor">
      ENGLISH / ESPAÑOL / FRANÇAIS / DEUTSCH{' '}
    </h4>
    <p>
      Switches language to Spanish, French, or German. Language changes on
      Signalboost are user-specific, so if you change your language to Spanish
      other admins and subscribers' channels will be unaffected.
    </p>
    <h4 id="leave" className="anchor">
      GOODBYE
    </h4>
    <p>
      Leaves the channel. If you're an admin, you will lose your admin access to
      the channel but will still be able to subscribe as a subscriber. If you
      want to obtain admin access again, you will need to ask a current admin to
      add you using the ADD command.
    </p>
    <h4 id="destroy" className="anchor">
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
