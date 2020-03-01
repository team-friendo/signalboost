import React from 'react'
import Layout from '../components/layout'
import SEO from '../components/seo'

const IndexPage = () => (
  <Layout>
    <SEO title="Signalboost: Secure Textblasts and Hotlines for Activists" />
    <p>
      Signalboost lets activists use Signal to send text blasts and receive
      hotline tips on their phones without revealing their identity or spending
      money. <br />
      It is <em style={{ color: '#ff79c6' }}>secure, simple, and free.</em>
    </p>
    <h3>Secure:</h3>
    <ul>
      <li>
        Signalboost sends messages over <a href="https://signal.org">Signal</a>,
        the most secure encrypted messaging service available for phones.
      </li>
      <li>
        It does not display phone numbers or names. People can send and receive
        messages without sharing their identity -- and feel safer if anyone's
        phone is stolen.
      </li>
      <li>
        Signalboost retains the minimal user metadata necessary to route
        messages. Its maintainers, Team Friendo, will resist any attempt to
        compel us disclose it, and are working on{' '}
        <a href="https://0xacab.org/team-friendo/signalboost/issues/68">
          updates
        </a>{' '}
        make such disclosure impossible.
      </li>
    </ul>
    <h3>Simple:</h3>
    <ul>
      <li>
        Signalboost is for 1-way messaging only. Admins can send announcements
        to large groups and receive hotline tips from anyone. That's it.
      </li>
      <li>
        It does not allow subscribers to send messages to each other. This cuts
        out cross talk endemic to large Signal or WhatsApp groups.
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
    <h1>Getting Started</h1>
    <h3>To get a Signalboost channel:</h3>
    <ul>
      <li>
        Send a Signal message to{' '}
        <span style={{ color: '#bd93f9' }}>+1-938-444-8536</span>.
      </li>
      <li>
        Include a name for the channel and the phone numbers of all admins.
      </li>
      <li>
        You will receive a welcome message as soon as your channel is created.
      </li>
    </ul>
    <h3>Once you have a channel:</h3>
    <ul>
      <li>
        There will be a signal phone number associated with your channel.
        Anytime you send a message to it, anyone who is subscribed will get that
        message.
      </li>
      <li>
        People can subscribe to announcements by sending a Signal message to
        this phone number that says "HELLO", "HOLA", "ALLÔ", or "HALLO" and
        leave by sending "GOOBYE", "ADIÓS", "ADIEU", or "TSCHÜSS".
      </li>
      <li>
        Signalboost speaks English, Spanish, French, and German and language
        preference is specific to each user. Send a Signal message to the
        channel that says "HELP" to see the command options.
      </li>
      <li>
        You can convert the channel into a hotline by sending a message that
        says "HOTLINE ON" to your channel number.
      </li>
    </ul>
    <h1>Got questions?</h1>
    <ul>
      <li>
        Send us a signal message at{' '}
        <span style={{ color: '#bd93f9' }}>+1-938-444-8536</span>
      </li>
      <li>
        Send us an email at{' '}
        <a href="mailto:team-friendo@protonmail.com">
          team-friendo@protonmail.com
        </a>{' '}
        or <a href="mailto:team-friendo@riseup.net">team-friendo@riseup.net</a>
      </li>
      <li>
        Find our{' '}
        <a href="http://keys.gnupg.net/pks/lookup?search=0xE726A156229F56F1&fingerprint=on&op=index">
          PGP key here
        </a>
      </li>
      <li>
        Visit our&nbsp;
        <a href="https://0xacab.org/team-friendo/signalboost">gitlab page</a>
        &nbsp;to learn more technical details, read our source code, request a
        new feature, report a bug, or become a contributor!
      </li>
    </ul>
  </Layout>
)

export default IndexPage
