import { Link } from 'gatsby'
import React from 'react'
import Layout from '../components/layout'

export default () => (
  <Layout>
    <h2>About Signalboost</h2>
    <p>
      Signalboost was born out of a need we saw in the movement space: to
      empower people to quickly amplify their message to thousands of people and
      directly engage those who want to get involved, in a secure and private
      way.
    </p>
    <p>
      In an industry that prioritizes aggressive growth and monetization, we
      want to build something small, well-considered, and impactful for our
      community.
    </p>
    <p>
      As of November 2020, Signalboost is a fiscally sponsored project of the
      nonprofit <a href="https://aspirationtech.org/">Aspiration Tech.</a> We
      cover our operating costs via grants and{' '}
      <Link to="/donate">donations from our community.</Link>
    </p>
    <h3>The technology</h3>
    <p>
      Signalboost is a message forwarding service that uses (but is not
      affiliated with!) <a href="https://signal.org/">Signal Messenger</a> to
      deliver messages. Our software enables Signalboost to programmatically
      purchase a number and from then on out, admins can broadcast messages to
      subscribers from that number or use it as a hotline.
    </p>
    <h3>Your privacy and safety</h3>
    <p>
      No app is perfect when it comes to your digital privacy, and we don't
      purport to be.{' '}
    </p>
    <p>
      We're a big fan of Signal's built-in{' '}
      <a href="https://support.signal.org/hc/en-us/articles/360007320391-Is-it-private-Can-I-trust-it-">
        security features
      </a>{' '}
      such as world-class encryption and disappearing messages (which we enable
      by default).
    </p>
    <p>
      One of the best reasons to use Signalboost is that admins and subscribers
      don't have to reveal their phone numbers, and thus their identities.
    </p>
    <p>
      However, in order to make that possible we store the lists of the admins
      and subscribers. We have deeply considered what it means to be good
      stewards of this data, and highly encourage you to understand these
      tradeoffs by reading our <Link to="/privacy">Privacy Policy</Link>.
    </p>
    <h3>Limitations</h3>
    <p>
      Signalboost is a beta technology! We try our best to monitor uptime and
      make message delivery go fast, but sometimes our infrastructure comes
      under heavy load.
    </p>
    <h4>Subscriber limits</h4>
    <p>
      After your channel hits 500 subscribers, new users will be prevented from
      subscribing until existing subscribers leave.{' '}
    </p>
    <p>
      If you are in an urgent situation and would like to request a larger
      channel you can do so by sending us a special request via Signal message
      via our helpline <span className="purple">+1-947-800-5717</span>. We are
      working hard to support channels over 500 subscribers, but that work
      requires time and resources. You can help us get there by{' '}
      <Link to="/donate">donating!</Link>
    </p>
    <h4>Message delivery delays</h4>
    <p>
      Your channel will also take longer to send broadcasts the bigger it grows:
      ~1-2 minutes on a channel with 250 subscribers vs. ~5-10 minutes on a
      channel with 500 subscribers.
    </p>
    <h3>Contact</h3>
    <p>
      To learn about how to request a channel and use it, check out our{' '}
      <Link to="/how-to">How-To Guide</Link>.
    </p>
    <p>
      If you want to reach us, you can send us an email at{' '}
      <a href="mailto:signalboost@protonmail.com">signalboost@protonmail.com</a>{' '}
      (or, if you prefer old-school:{' '}
      <a href="mailto:signalboost@riseup.net">signalboost@riseup.net</a> +{' '}
      <a href="http://keys.gnupg.net/pks/lookup?search=0xE726A156229F56F1&fingerprint=on&op=index">
        PGP
      </a>
      ).
    </p>
    <p>
      Read our code of conduct{' '}
      <a href="https://0xacab.org/team-friendo/signalboost/-/wikis/Team-Friendo-Values-and-CoC">
        here.
      </a>
    </p>
    <p>
      Read our source code{' '}
      <a href="https://0xacab.org/team-friendo/signalboost">here.</a>
    </p>
  </Layout>
)
