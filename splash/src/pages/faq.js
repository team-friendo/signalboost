import { Link } from 'gatsby'
import React from 'react'
import Layout from '../components/layout'

export default () => (
  <Layout>
    <h2>FAQ</h2>
    <ul>
      <li>
        <a href="#donate">Do I need to pay to have a Signalboost channel?</a>
      </li>
      <li>
        <a href="#security">
          How does Signalboost protect my phone number and identity?
        </a>
      </li>
      <li>
        <a href="#signal">
          Do I need to be using the Signal app to get messages from Signalboost?
        </a>
      </li>
      <li>
        <a href="#vouch">Can we control who can sign up for our channel?</a>
      </li>
      <li>
        <a href="#opensource">
          Who runs Signalboost? Can you add a feature to the tool?
        </a>
      </li>
      <li>
        <a href="#instance">Can I run Signalboost on my own servers?</a>
      </li>
    </ul>
    <h3>
      <span name="donate" class="anchor" />
      Do I need to pay to have a Signalboost channel?
    </h3>
    <p>
      We are inspired by the work that community organizers do and are committed
      to offering this tool for free for anyone who requests it. That being
      said, it costs around $5/month for us in server and infrastructure fees to
      run each channel. If your org can afford it, consider making a{' '}
      <Link to="/donate">recurring donation!</Link>
    </p>
    <h3>
      <span name="security" class="anchor" />
      How does Signalboost protect my personal phone number and identity?
    </h3>
    <p>
      Signalboost protects your identity by hiding your phone number from others
      members of a channel. No one on the channel, not even admins, can see the
      phone numbers of others on the channel.
    </p>
    <p>
      This significantly lowers the risk of you accidentally exposing
      information if your phone is seized or spied on. Because your phone number
      is a key part of your identity, using Signalboost helps care for you and
      your friends' current and future safety.
    </p>
    <p>
      In order to send messages to the correct recipients, the Signalboost
      sysadmins store lists of admins and subscribers on activist-maintained
      infrastructure. We are committed to protecting this information and would
      love to talk to anyone interested in deploying and maintaining their own
      instance of Signalboost so that fewer people need to trust us.
    </p>
    <h3>
      <span name="signal" class="anchor" />
      Do I need to be using Signal to use a Signalboost channel?
    </h3>
    <p>
      Yes. All participants in a Signalboost channel must be using Signal
      Messenger. Signal is a well-vetted and secure app that provides both the
      encryption and delivery mechanism for your Signalboost messages.
    </p>
    <h3>
      <span name="vouch" class="anchor" />
      Can we control who can sign up for our channel?
    </h3>
    <p>
      Yes, Signalboost offers vouching, which means that admins can control who
      can send invites and how many invites are required to join a channel.
      Check out our{' '}
      <a href="https://signalboost.info/how-to/#vouching">documentation </a>for
      more on vouching.
    </p>
    <h3>
      <span name="opensource" class="anchor" />
      Who runs Signalboost? Can you add a feature to the tool?
    </h3>
    <p>
      Signalboost is currently a bootstrapped, not-for-profit open source tool
      maintained and cared for by people who care about your privacy. We are
      currently in the process of securing funding to try and dedicate more
      full-time development effort, additional security measures, and a better
      user experience to the tool.
    </p>
    <p>
      If you are an angel donor or well-resourced organization that could
      benefit from additional features, please contact our helpline (on Signal):{' '}
      <span className="purple">+1-947-800-5717</span> or send us an email at{' '}
      <a href="mailto:team-friendo@protonmail.com">
        team-friendo@protonmail.com
      </a>
      .
    </p>
    <h3>
      <span name="instance" class="anchor" />
      Can I run Signalboost on my own server?
    </h3>
    <p>
      Absolutely! We would love to have more partners running their own
      Signalboost instances. Find instructions to deploy Signalboost on{' '}
      <a href="https://0xacab.org/team-friendo/signalboost/">Gitlab.</a> We'd
      love to hear from you via our hotline, email, or Gitlab issues if this is
      something you'd like to do.
    </p>
  </Layout>
)
