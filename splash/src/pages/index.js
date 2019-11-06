import React from 'react'
import { Link } from 'gatsby'

import Layout from '../components/layout'
import SEO from '../components/seo'

const IndexPage = () => (
  <Layout>
    <SEO title="Signalboost: Secure Textblasts and Hotlines for Activists" />
    <p>
      Signalboost lets activists send text blasts and receive hotline tips on
      their phones without revealing their identity or spending money. It is{' '}
      <em style={{ color: '#ff79c6' }}>
        secure, simple, and free.
      </em>
    </p>

    <h3>Secure:</h3>
    <ul>
      <li>
        Signalboost sends messages over <Link to="signal.org">Signal</Link>, the
        most secure encrypted messaging service available for phones.
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
        <Link to="0xacab.org/team-friendo/signalboost/issues/68">updates</Link>{' '}
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
        profit. We do not charge money for it and never will
      </li>
    </ul>

    <h1>Getting Started</h1>

    <h3>To get a Signalboost channel:</h3>
    <ul>
      <li>Send a Signal message to +1-938-444-8536</li>
      <li>
        Include a name for the channel and the phone numbers of all admins
      </li>
      <li>
        You will receive a welcome message as soon as your channel is created
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
        this phone number that says "HELLO" or "HOLA" and leave by sending
        "GOOBYE" or "ADÌOS."
      </li>
      <li>
        You can convert the channel into a hotline by sending a message that
        says "RESPONSES ON" to your channel number.
      </li>
    </ul>

    <h1>Learn More</h1>
    <p>If you have questions, we'd love to hear from you! You can...</p>
    <ul>
      <li>
        Send us a signal message at{' '}
        <span style={{ color: '#bd93f9' }}>+1-938-444-8536</span>
      </li>
      <li>
        Send us an email at{' '}
        <Link to="mailto:team-friendo@protonmail.com">
          team-friendo@protonmail.com
        </Link>
      </li>
      <li>
        Visit our&nbsp;
        <Link to="0xacab.org/team-friendo/signalboost">gitlab page</Link>
        &nbsp;to learn more technical details, read our source code, file a bug
        report, or become a contributor!
      </li>
    </ul>
  </Layout>
)

export default IndexPage
