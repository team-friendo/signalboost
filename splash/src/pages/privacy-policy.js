import React from 'react'
import Layout from '../components/layout'

const PrivacyPolicyPage = () => (
  <Layout>
    <h1 id="privacy-policy">Privacy Policy</h1>
    <p>
      We created Signalboost because we care about your privacy and want to keep
      you safe. In a nutshell, our privacy policy is that we collect and retain
      the least possible data needed in order to keep our service up and running
      and we will never monetize that data for our own profit. Of the data we do
      retain, we delete as much of it as often as possible.
    </p>
    <p>
      In order to send messages to the right people, Signalboost needs to keep
      track of a list of admins and subscribers for each channel. The
      maintainers of Signalboost retain that information on our servers
      according to the policies described below.{' '}
    </p>
    <p>
      We work hard to protect your data as much as possible, but ulimately you
      are your own best privacy defender. The purpose of this policy is to
      provide as much transparency as we can to empower you to make a
      well-informed decision on your own digital safety needs.
    </p>
    <h2>Your message contents</h2>
    <p>
      In order to relay messages from senders to recipients, Signalboost renders
      the contents of your messages momentarily visible to our software but not
      to its maintainers.
    </p>
    <p>In detail:</p>
    <ul>
      <li>
        Messages are received encrypted to channel phone numbers, decrypted
        emphemerally, then rencrypted to subscriber phone numbers
      </li>
      <li>
        Cleartext messages are held in memory for the duration it takes to
        transmit messages from the channel to subscribers (usually on the order
        of milliseconds) and then are deleted
      </li>
      <li>
        Signalboost maintainers do not read or store the content of messages
      </li>
      <li>
        To help us debug Signalboost, we sometimes store redacted logs of
        message transmission for up to 2 weeks. These logs include timestamps of
        when messages were sent and hashed/salted versions of the message
        sender, recipient, and message contents.{' '}
      </li>
    </ul>
    <h2 id="metadata">Metadata</h2>
    <p>
      There are a few pieces of metadata that we need to retain in order to
      provide the functionality of sending out broadcasts to large numbers of
      people at a low cost. This includes:{' '}
    </p>
    <h3 id="user-metadata">User metadata</h3>
    <p>
      We keep lists of the phone numbers of subscribers and admins so we can
      tell what channels they belong to or are being invited to, and the phone
      numbers of senders of &quot;hotline messages&quot; so we can allow admins
      to respond to them without seeing the sender&#39;s phone number.
    </p>
    <p>In detail, our database stores:</p>
    <ul>
      <li>
        The phone numbers of all admins and subscribers (deleted when they
        unsubscribe from all channels)
      </li>
      <li>
        Lists of which phone numbers are admins or subscribers of which channel
        (deleted when user unsubscribes or channel is destroyed by admin or
        recycled by sysadmin)
      </li>
      <li>
        Lists of which phone numbers have invited which other phone numbers to
        join a channel (deleted once invite is accepted, declined, or 2 weeks
        have passed -- whichever is sooner)
      </li>
      <li>
        Lists of which phone numbers have sent an incoming &quot;hotline
        message&quot; to which channels (used to route anonymous replies to
        hotline messages, deleted 4 weeks after last hotline message from a
        given number is send)
      </li>
      <li>
        Lists of which phone numbers have mistakenly send SMS numbers to a
        channel instead of using signal (used to rate limit users to one
        incoming SMS message to prevent flooding attacks to make us pay for lots
        of SMS message processing, deleted after 4 weeks)
      </li>
      <li>
        Lists of the hashed/salted phone numbers of an users who have been
        banned from a channel for abusive behavior.
      </li>
    </ul>
    <h3 id="channel-metadata">Channel metadata</h3>
    <p>
      We store some descriptive information about channels that the channels
      make publicly visible to their members.
    </p>
    <p>In detail, we store:</p>
    <ul>
      <li>
        The name and public description of each channel (deleted when channel
        destroyed)
      </li>
      <li>Susbcriber counts per channel (deleted when channel destroyed)</li>
      <li>
        The state of various feature toggls (such as whether vouching or hotline
        messages are enabled, etc.)
      </li>
    </ul>
    <h2 id="data-deletion">Data deletion</h2>
    <p>
      We regularly delete as much data as we can as often as possible and offer
      users the ability to delete their own data whenever they want.
    </p>
    <p>In detail:</p>
    <ul>
      <li>
        We allow channel admins to completely destroy all metadata associated
        with their channel (including admin and subscriber phone numbers,
        records of memberhip on the channel, lists of invites, hotline messages,
        and the twilio phone number itself) at any time by issuing a
        &quot;DESTROY&quot; command to their channel
      </li>
      <li>
        Every month, signalboost sysadmins &quot;recycle&quot; channels that
        have not been used recently, which results in the destruction of all
        metadata records deleted in channel destruction, but maintains the
        twilio phone number for reuse in other channels
      </li>
      <li>
        Every hour we run deletion jobs that destroy:
        <ul>
          <li>all invite records older than 2 weeks</li>
          <li>all hotline message sender records older than 4 weeks</li>
          <li>all incoming sms sender records older than 4 weeks</li>
        </ul>
      </li>
    </ul>
    <h2 id="third-parties">Third Parties</h2>
    <h3 id="community-maintained-instances">Community-Maintained Instances</h3>
    <p>
      Signalboost is free software which can hosted by anyone. That means that
      channels can be hosted by maintainers other than us. This privacy policy
      only applies to the metadata collected by the maintainers of Signalboost.
      We are not responsible for the privacy policy of community instances, but
      we hope they will seek to be at least as good stewards of user data as we
      endeavor to be with yours.
    </p>
    <h3 id="signal">Signal</h3>
    <p>
      Signalboost relies on the user interface and world-class encryption
      protocol developed by Signal, but is no way affiliated with the Signal
      Foundation. Signal&#39;s Privacy Policy can be found{' '}
      <a href="https://signal.org/legal/">here</a>.{' '}
    </p>
    <h3 id="twilio">Twilio</h3>
    <p>
      The phone number used to broadcast out messages and act as a hotline is
      registered by us via Twilio.
    </p>
    <p>
      Once registered, we pay a monthly fee to maintain the sole users of that
      phone number, but Twilio does not log or have acccess to message contents
      routed through Signalboost.
    </p>
    <p>
      Though highly unlikely, Twilio could be compelled to grant control of the
      phone number to a sophisticated attacker. This attacker could then use
      control of the phone number to reregister it with Signal, thereby denying
      users use of their Signalboost channel. Despite the unlikelihood of this
      attack, we are working to deploy PIN lock registration which would block
      anyone other than channel admins from controlling the Twilio phone number.
    </p>
    <p>
      Twilio&#39;s privacy policy can be found here:{' '}
      <a href="https://www.twilio.com/legal/privacy">
        https://www.twilio.com/legal/privacy
      </a>
    </p>
    <h3 id="donation-vendors">Donation Vendors</h3>
    <p>
      We use Stripe, Venmo, and BTC to process credit card payments. The
      Signalboost maintainers have access to these accounts and can view their
      payment history. We respect the privacy of our donors and will use the
      minimum necessary information from these accounts to use donations to fund
      costs (servers, etc) associated with the project.
    </p>
    <ul>
      <li>
        <a href="https://stripe.com/privacy">Stripe's Privacy Policy</a>
      </li>
      <li>
        Venmo&#39;s Privacy Policy:{' '}
        <a href="https://venmo.com/legal/us-privacy-policy/">
          Venmo's Privacy Policy
        </a>
      </li>
    </ul>
    <h2 id="this-website">This website</h2>
    <p>
      In order to maintain the availability of this site, the IP addresses of
      visitors to this site are visible in logs which the maintainers have
      access to. These logs are deleted every 2 weeks and only ever inspected in
      the case of potential denial-of-service attacks.
    </p>
    <h2 id="funding">Funding</h2>
    <p>
      This project is currently funded mostly from private individual donations,
      though we are currently soliciting foundation funding to ensure the
      long-term stability of the project. The maintainers of Signalboost are
      working diligently to ensure that no source of funding will compormise the
      integrity of the project and what type of channels we support.
    </p>
    <h2 id="contacting-us">Contacting us</h2>
    <p>
      If you have any concerns or questions about this privacy policy, The
      maintainers of Signalboost can be contacted in two ways: email and a
      Signalboost channel called &quot;Signalboost Announcements and
      Helpline.&quot;
    </p>
    <ul>
      <li>
        Helpline (on Signal): <span className="purple">+1-947-800-5717</span>
      </li>

      <li>
        Email:{' '}
        <a href="mailto:signalboost@protonmail.com">
          signalboost@protonmail.com
        </a>{' '}
        (or, if you prefer old-school:{' '}
        <a href="mailto:signalboost@riseup.net">signalboost@riseup.net</a> +{' '}
        <a href="http://keys.gnupg.net/pks/lookup?search=0xE726A156229F56F1&fingerprint=on&op=index">
          PGP
        </a>
        ).
      </li>
    </ul>
    <p>This privacy policy is effective as of 10/13/2020.</p>
    <h2 id="inspo">Inspiration</h2>
    <p>This privacy policy is modeled after:</p>
    <ul>
      <li>
        <a href="https://www.opentech.fund/about/tos/otf-responsible-data-policy/">
          The Open Technology Fund
        </a>
      </li>
      <li>
        <a href="https://themarkup.org/privacy/">The Markup</a>
      </li>
    </ul>
  </Layout>
)

export default PrivacyPolicyPage
