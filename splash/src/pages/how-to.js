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
      that includes channel name and the phone numbers of at least 2 admins. For
      example:
    </p>
    <blockquote className="command blockquote-skinny">
      <p>Test Channel +1-123-555-5555, +1-123-555-5555</p>
    </blockquote>
    <p>
      You will receive a welcome message from your new channel phone number as
      soon as your channel is created.
    </p>
    <p>
      You can write our helpline with questions or a request for a more in-depth
      training, and we'll get back to you asap!
    </p>
    <h3 className="getting-started-header">
      4. Send announcements to (up to 500) subscribers
    </h3>
    <p>
      Now, any anyone who sends "HELLO" to your channel number will get
      announcements you send out!
    </p>
    <p>
      You can publish your channel phone number on Instagram or keep it to a
      close circle. Note: after your channel hits 500 subscribers, new users
      will be prevented from subscribing until existing subscribers leave. Your
      channel will also take longer to send broadcasts the bigger it grows: ~1-2
      minutes on a channel with 250 subscribers vs. ~5-10 minutes on a channel
      with 500 subscribers.
    </p>
    <p>
      If you are in an urgent situation and would like to request a larger
      channel you can do so by sending us a special request via Signal message
      at 947-BOOSTIT (+1-947-800-5717). However, please note that large channels
      put stress on our servers and team. We are working hard to make
      Signalboost support channels over 500 subscribers, but that work requires
      time and resources. You can help us get there by{' '}
      <Link to="/donate">donating!</Link>
    </p>
    <h2>Signalboost Guide</h2>
    <p>
      A Signalboost channel is a phone number that keeps track of admins and
      subscribers. Any time an admin sends a message to the channel, it is
      interpreted as a command or a broadcast. If admins send a broadcast, all
      of the subscribers will see it, but Signalboost will route the broadcast
      so that it appears as if coming from the channel phone number.
    </p>
    <p>
      People have described Signalboost as "BCC, but for messaging," "secure SMS
      blasts," and "Celly, but over Signal."{' '}
    </p>
    <h3>Commands & languages</h3>
    <p>
      A command is a word or phrase sent as a Signal message that Signalboost
      will interpret as an instruction. Some commands can only be used by
      admins. If you're unsure which command to use, the HELP command is a great
      place to start.
    </p>
    <p>
      Signalboost currently supports{' '}
      <span className="purple">English, Spanish, French, and German</span>. To
      switch to your language of choice, type the name of the language into the
      channel. For example, if I want to switch my language to Spanish, I would
      send "ESPAÑOL" to the channel.
    </p>
    <h3>Disappearing Messages</h3>
    <p>
      By default, messages on Signalboost channels disappear after 1 week.
      However, admins and admins only can override the 1-week duration using the
      disappearing message timer in the top right hand corner of the Signal app.
      We recommend shortening the duration of disappearing message timer
      (usually to 1 day or 6 hours) if your broadcasts will contain sensitive
      information.
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
    <h3>
      How can I see my channel name, description, and how many people are
      subscribed?
    </h3>
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
    <h4 id="rename" className="anchor">
      RENAME new name
    </h4>
    <p>Renames channel to "new name"</p>
    <p>
      <blockquote className="command blockquote">
        RENAME My Cool Signalboost Channel
      </blockquote>
    </p>
    <h4 id="description" className="anchor">
      DESCRIPTION description of channel
    </h4>
    <p>Adds or updates public description of channel.</p>
    <p>
      <blockquote className="command blockquote">
        DESCRIPTION This is the _super cool activist_ signalboost channel! We'll
        use it to make announcements for the upcoming protest.
      </blockquote>
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
