import React from 'react'
import Layout from '../components/layout'
import SEO from '../components/seo'
import { Link } from '@reach/router'

const IndexPage = () => (
  <Layout>
    <SEO title="Signalboost: Secure Textblasts and Hotlines for Activists" />
    <p>
      Signalboost lets activists use Signal to send text blasts and receive
      hotline tips without revealing their identity or spending money. It is{' '}
      <em style={{ color: '#ff79c6' }}>secure, focused, and free.</em>
    </p>
    <h3>Secure:</h3>
    <ul>
      <li>
        Signalboost sends messages over <a href="https://signal.org">Signal</a>,
        the most secure encrypted messaging service available for phones.
      </li>
      <li>
        It does not display phone numbers or names. People can send and receive
        messages without sharing their identity and be safer if anyone's phone
        is stolen or seized.
      </li>
      <li>
        Signalboost retains the minimal user metadata necessary to route
        messages. Its maintainers, team-friendo, will resist any attempt to
        compel us disclose it, and are working on{' '}
        <a href="https://0xacab.org/team-friendo/signalboost/issues/68">
          updates
        </a>{' '}
        make such disclosure impossible.
      </li>
    </ul>
    <h3>Focused:</h3>
    <ul>
      <li>
        Signalboost is for 1-way messaging only. Admins can send announcements
        to large groups, or receive and reply to hotline messages from anyone.
        That's it.
      </li>
      <li>
        Signalboost does not allow subscribers to send messages to each other.
        This cuts out cross talk endemic to large Signal or WhatsApp groups.
      </li>
      <li>
        It tries to solve one problem and solve it well. This makes it easier to
        know what it's for amidst a dizzying sea of tech tools!
      </li>
    </ul>
    <h3>Free:</h3>
    <ul>
      <li>
        We are making this software for people's collective liberation, not for
        profit. We do not charge money for it and never will.
      </li>
    </ul>
    <h2>Getting Started</h2>
    <h3>Try joining a channel:</h3>
    <p>
      Send HELLO to <span className="purple">+1-938-222-9889</span> to join our
      Signalboost playground channel.
    </p>
    <p>Send HELP to see the commands you can use and GOODBYE to leave.</p>
    <h3>Get your own channel:</h3>
    <p>
      Send a Signal message to <span className="purple">+1-947-800-5717</span>{' '}
      that includes a name for the channel and the phone numbers of at least 2
      admins. (You can remember that as:{' '}
      <span className="purple">947 BOOST IT!</span>)
    </p>
    <p>
      You will receive a welcome message as soon as your channel is created.
    </p>
    <p>
      You can also write team-friendo with support questions at any time on this
      channel , and we will do our best to respond promptly.
    </p>
    <h3>Once you have a channel:</h3>
    <ul>
      <li>
        There will be a Signal phone number associated with your channel.
        Anytime you send an announcement to your channel's phone number, anyone
        who is subscribed will get the announcement.
      </li>
      <li>
        Your friends can subscribe to announcements by sending a Signal message
        to your channel phone number that says "HELLO." ("HOLA", "SALUT", or
        "HALLO" also work!) They can unsubscribe by sending "GOODBYE." ("ADIÓS",
        "AREVOIR", or "TSCHÜSS" also work!)
      </li>
      <li>
        You can convert the channel into a hotline by sending a message that
        says "HOTLINE ON" to channel number.
      </li>
      <li>
        Signalboost speaks English, Spanish, French, and German. Each user can
        specify their own personal language preference by sending a message with
        the name of the language they want to use to the channel. (E.g., to
        change the channel language to Spanish, you would send "ESPAÑOL.")
      </li>
      <li>
        All users can send a message to the channel that says "HELP" to list all
        command options or "INFO" to learn basic information about the channel.
      </li>
    </ul>
    <h2>Got questions?</h2>
    <ul>
      <li>
        Check out the <Link to="/faq">FAQ</Link> or{' '}
        <Link to="/how-to">How-To Manual</Link>
      </li>
      <li>
        Try out commands by Signal-messaging the playground channel at:
        <span className="purple">+1-938-222-9889</span>
      </li>
      <li>
        Talk to us directly by Signal-messaging our support channel at:{' '}
        <span className="purple">+1-947-800-5717</span> (That's <span className="purple">"947 BOOST IT!"</span>)
      </li>
      <li>
        Send us an email at{' '}
        <a href="mailto:team-friendo@protonmail.com">
          team-friendo@protonmail.com
        </a>{' '}
        or <a href="mailto:team-friendo@riseup.net">team-friendo@riseup.net</a>.
        (Find our{' '}
        <a href="http://keys.gnupg.net/pks/lookup?search=0xE726A156229F56F1&fingerprint=on&op=index">
          PGP key here
        </a>
        .)
      </li>
      <li>
        Visit our&nbsp;
        <a href="https://0xacab.org/team-friendo/signalboost">gitlab page</a>
        &nbsp;to read our source code and{' '}
        <a href="https://0xacab.org/team-friendo/signalboost/-/wikis/Team-Friendo-Values-and-CoC">
          code of conduct
        </a>
        , request a new feature, report a bug, or become a contributor!
      </li>
    </ul>
  </Layout>
)

export default IndexPage
