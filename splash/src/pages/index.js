import React from 'react'
import Layout from '../components/layout'
import SEO from '../components/seo'
import { Link } from '@reach/router'

const IndexPage = () => (
  <Layout>
    <SEO title="Signalboost: Secure Textblasts and Hotlines for Activists" />
    <p>
      Signalboost gives grassroots organizers the power to communicate with mass
      audiences <span className="purple">securely</span> and{' '}
      <span className="purple">directly</span> via message broadcasts and
      hotlines.
    </p>
    <h3>Reach thousands of people directly</h3>
    <ul>
      <li>
        Organizers need quick and direct ways to disseminate information.
        However, on social media platforms, important info is often obscured by
        algorithms and other posts. Signalboost messages go directly to
        subscribers' message inboxes.
      </li>
      <li>
        Organizing in big group chats gets messy quickly and unnecessarily
        exposes strangers' phone numbers to each other. Broadcasts offer a quick
        way disseminate information directly to thousands of people.
      </li>
    </ul>
    <h3>Respond to people individually and privately</h3>
    <ul>
      <li>
        Subscribers to Signalboost channels can send in anonymous messages to
        the hotline and admins can respond directly and privately to that
        susbcriber.
      </li>
      <li>
        Subscribers do not see other subscribers' messages to the hotline. Only
        admins can see them.
      </li>
    </ul>
    <h3>Stay safe from censorship and surveillance</h3>
    <ul>
      <li>
        Signalboost sends messages over <a href="https://signal.org">Signal</a>,
        the most secure encrypted messaging service for phones.
      </li>
      <li>
        By obscuring personal phone numbers, enforcing disappearing messages,
        and controlling who is allowed to join their channel, Signalboost
        empowers organizers to stay safe while speaking freely.
      </li>
    </ul>
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
    <blockquote className="channel-request">
      <p>Test Channel</p>
      <p>+1-123-555-5555, +1-123-555-5555</p>
    </blockquote>
    <p>
      You will receive a welcome message as soon as your channel is created.
    </p>
    <p>
      You can write our helpline with questions or a request for a more in-depth
      training, and we'll get back to you asap!
    </p>
    <h3 className="getting-started-header">
      4. Get subscribers and send announcements
    </h3>
    <p>
      Now, any anyone who sends "HELLO" to your channel number will get
      announcements you send out!
    </p>
    <p>
      Check out our <Link to="/how-to">How-To Guide</Link> to get started with
      your channel, learn about other features, and supported languages.
    </p>
    <h2>Got questions?</h2>
    <p>
      Check out the <Link to="/faq">FAQ</Link> or{' '}
      <Link to="/how-to">How-To Guide</Link>
    </p>
    <p>
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
    </p>
    <p>
      Signalboost is completely open source & committed to transparency. You can
      read our{' '}
      <a href="https://0xacab.org/team-friendo/signalboost">source code</a> and{' '}
      <a href="https://0xacab.org/team-friendo/signalboost/-/wikis/Team-Friendo-Values-and-CoC">
        code of conduct
      </a>{' '}
      on Gitlab.
    </p>
  </Layout>
)

export default IndexPage
