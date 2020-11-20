import React from 'react'
import Layout from '../components/layout'

export default () => (
  <Layout>
    <h2>Privacy Policy</h2>
    <p>
      We created Signalboost because we care about your privacy and want to keep
      you safe. In a nutshell, our privacy policy is that we collect and retain
      the least possible data in order to keep our service up and running. We
      delete the data we keep as often as we can and do as much as we can to
      preserve our users' rights in the face of law enforcement investigations.
      We pledge to never sell our users' data for our own profit.
    </p>
    <p>
      In order to send messages to the right people, Signalboost needs to store
      a list of the phone numbers of admins and subscribers for each channel.
      The maintainers of Signalboost retain and delete that information on our
      servers according to the policies described below. We work hard to protect
      your data as much as possible, but ultimately you are your own best
      privacy defender.
    </p>
    <p>
      The purpose of this policy is to provide as much transparency as we can to
      empower you to make a well-informed decision on your own digital safety
      needs.
    </p>
    <h3>Data we do not store</h3>
    <p>Signalboost does *not* store the following data about our users: </p>
    <ul>
      <li>Contents of messages sent by users [1]</li>
      <li> Individual usage statistics</li>
      <li>Names of users </li>
      <li>IP Addresses</li>
      <li> Financial information about users </li>
      <li>Data tying users to other services or accounts</li>
    </ul>
    <p>
      [1] In order to relay encrypted messages from senders to recipients,
      Signalboost momentarily decrypts the contents of messages from senders
      then re-encrypts them to their intended recipients. This means the
      contents of messages exist unencrypted or "cleartext" for a matter of
      milliseconds on our servers, and then are permanently destroyed.
    </p>
    <h3>Data we do store</h3>
    <p>
      Signalboost *does* store (and tries to delete as often as possible) the
      following data:
    </p>
    <h4>User metadata</h4>
    <p>
      We store lists of which phone numbers are subscribed to each Signalboost
      channel so that when an admin sends a message to the channel, Signalboost
      knows which subscribers to which it is supposed broadcast the message. We
      also temporarily store the phone numbers of subscribers who send "hotline
      messages" to the channel so that admins can respond to them without seeing
      the sender's phone number. In detail, our database stores:
    </p>
    <ul>
      <li>
        {' '}
        Lists of which phone numbers are admins or subscribers of which channel
        (DELETED when user unsubscribes from the channel or when channel is
        destroyed by admin, or when the channel is automatically destroyed due
        to inactivity){' '}
      </li>
      <li>
        Lists of which phone numbers have invited which other phone numbers to
        join a channel (deleted once invite is accepted, declined, or 2 weeks
        have passed -- whichever is shorter){' '}
      </li>
      <li>
        {' '}
        Lists of which phone numbers have sent an incoming "hotline message" to
        which channels (used to route anonymous replies to hotline messages,
        deleted 3 days after last hotline message from a given number is sent){' '}
      </li>
      <li>
        {' '}
        Lists of which phone numbers have mistakenly sent SMS numbers to a
        channel instead of using signal. We do this to prevent users from
        sending us thousands of SMS messages, which cost money to receive.
        (DELETED after 4 weeks)
      </li>
      <li>
        {' '}
        Lists of the hashed/salted phone numbers of any users who have been
        banned from a channel for abusive behavior. (Never deleted.){' '}
      </li>
    </ul>
    <h3>Data deletion </h3>
    <p>
      We regularly delete[3] as much data as we can as often as possible and
      afford users the ability to delete their own data whenever they want
      without any assistance from us.{' '}
    </p>
    <p>In detail: </p>
    <ul>
      <li>
        Every hour, Signalboost automatically deletes all channels that have not
        been used in the last week. Channel admins receive a notification giving
        them 24 hours to redeem the channel. If they do not respond, they system
        deletes all data associated with the channel -- including admin and
        subscriber phone numbers, records of memberhip on the channel, lists of
        invites, hotline messages, and the phone number registration.
      </li>
      <li>
        At any time, channel admins can completely and immediately destroy all
        data associated with their channel by issuing a "DESTROY" command to
        their channel. As with the automatic deletion script, all data
        associated with the channel is deleted.
      </li>
      <li>Every hour, we run deletion jobs that destroy:</li>
      <ul>
        <li>All hotline message sender records older than 3 days</li>
        <li>All invite records older than 1 week</li>
        <li>All incoming sms sender records older than 4 weeks</li>
      </ul>
    </ul>
    <p>
      [3] Securely deleting data in a manner that prevents it from being
      retroactively recovered by an adversary with advanced forensic
      capabilities is difficult. We do not currently delete data in a manner
      that prevents such recovery, but in future releases we will.
    </p>
    <h2>Third Parties</h2>
    <h3>Data sharing </h3>
    <p>
      We pledge never to share any of the above metadata with any private third
      party for any purpose. We will never voluntarily give user data to law
      enforcement officers, and will follow rigorous transparent protocols
      (documented in our "Legal Inquiry Policy") when responding to valid legal
      inquiries to ensure that our users receive every protection we are legally
      capable of giving them.
    </p>
    <p>
      Signalboost is free and open source software which can be hosted by
      anyone. That means that channels and their respective metadata can be
      hosted by maintainers other than us. This privacy policy only applies to
      the metadata collected by the maintainers of Signalboost. We are not
      responsible for the privacy policy of community instances, but we hope
      they will seek to be at least as good stewards of user data as we endeavor
      to be with yours.
    </p>
    <h3>Signal</h3>
    <p>
      Signalboost relies on the user interface and world-class encryption
      protocol developed by Signal, but is no way affiliated with the Signal
      Foundation. Signal&#39;s Privacy Policy can be found{' '}
      <a href="https://signal.org/legal/">here</a>.{' '}
    </p>
    <h3 id="phone-numbers">Phone numbers</h3>
    <p>
      The phone number used to broadcast out messages and act as a hotline is
      registered by us via <a href="https://www.twilio.com">Twilio</a>.
    </p>
    <p>
      We use that phone number one time only: to receive an authentication code
      via SMS to register an channel&#39;s phone number as a valid account with
      the Signal messaging service. Once the number has been registered, we pay
      a monthly fee to maintain the sole users of that phone number, so that
      nobody can hijack the Signal account. However, that is the sole extent of
      the application&#39;s interaction with the service. Twilio does not log or
      have acccess to message contents routed through Signalboost, nor any
      metadata about when that phone number is used when as an id for routing
      messages within Signalboost.
    </p>
    <p>
      Twilio&#39;s privacy policy can be found{' '}
      <a href="https://www.twilio.com/legal/privacy">here</a>.
    </p>
    <h3 id="server-hosting">Server hosting</h3>
    <p>
      Signalboost hosts data on servers maintained by movement-friendly,
      GDPR-compliant service providers based in Iceland and the Netherlands.
    </p>
    <h3>Donation Vendors</h3>
    <p>
      We use Stripe, Venmo, and BTC to process credit card payments. The
      Signalboost maintainers have access to these accounts and can view their
      payment history. We respect the privacy of our donors and will use the
      minimum necessary information from these accounts to use donations to fund
      costs (servers, etc) associated with the project.
    </p>
    <ul>
      <li>
        Stripe&#39;s Privacy Policy can be viewed here:{' '}
        <a href="https://stripe.com/privacy">https://stripe.com/privacy</a>
      </li>
      <li>
        Venmo&#39;s Privacy Policy:{' '}
        <a href="https://venmo.com/legal/us-privacy-policy/">
          https://venmo.com/legal/us-privacy-policy/
        </a>
      </li>
    </ul>
    <h2 id="legal-inquiries">Legal Inquiries</h2>
    <h3 id="responding-to-government-requests-for-information">
      Responding to Government Requests for Information
    </h3>
    <p>
      In the case of a law enforcement inquiry, we will insist on a valid,
      well-scoped warrant, court order, or subpeona before surrendering any data
      about our users. We reserve right to review and mount a legal challenge to
      the scope and validity of any request.
    </p>
    <p>
      If we receive a request to surrender information that is found to be valid
      and well-scoped, we will attempt to give direct notice to our users to
      give them a chance to defend themselves before surrendering such
      information.
    </p>
    <p>
      Unless we are constrained from doing so by a court-issued gag order, we
      will inform the affected user of the legal request via Signal message,
      provide a reasonable waiting period to allow users to challenge the
      request, and refrain from surrendering any data until a user-mounted legal
      challenge concludes. In all cases, we will publish a redacted version of
      the legal proceedings on our website.
    </p>
    <h3>Responding to Gag Orders</h3>
    <p>
      We might be legally constrained from immediately informing our users and
      the public of a legal inquiry by a court-issued gag order.{' '}
    </p>
    <p>
      If we receive a gag order accompanying any government request for
      information, we will attempt where possible to challenge the gag order in
      court and provide direct notice to our affected users as decribed above.
      If we are compelled to comply with the gag order, we will seek to both
      directly notify our users and publish the legal proceedings as soon as
      legally permitted.
    </p>
    <h3>Pledge to not sell out our users</h3>
    <p>
      We pledge to never actively &quot;sell out&quot; our users. To us that
      means that we will:
    </p>
    <ul>
      <li>
        Never knowingly allow any of our users to use Signalboost to conduct
        surveillance of other users.
      </li>
      <li>
        Never willingly modify our software to enable it to conduct surveillance
        of our users.{' '}
      </li>
      <li>
        Never transmit user data to any private third party -- unless it is at
        the direction of or with the explicitly-granted consent of the user
        whose data is being shared.
      </li>
      <li>
        Never voluntarily surrender any data to law enforcement agencies without
        insisting on the due process guidelines outlined above.
      </li>
    </ul>
    <h3>This website</h3>
    <p>
      This website does not log or store the IP addresses of people who visit
      it.
    </p>
    <h2>Contacting us</h2>
    <p>
      If you have any concerns or questions about this privacy policy, The
      maintainers of Signalboost can be contacted in two ways: email and a
      Signalboost channel called &quot;Signalboost Announcements and
      Helpline.&quot;
    </p>
    <ul>
      <li>Hotline: +1-947-800-5717</li>
      <li>
        Email: signalboost@protonmail.com (or, if you prefer old-school:
        signalboost@riseup.net + PGP).
      </li>
    </ul>
    <p>This privacy policy is effective as of 10/13/2020.</p>
    <h3>Inspo</h3>
    <p>This privacy policy is modeled after:</p>
    <ul>
      <li>
        <a href="https://www.opentech.fund/about/tos/otf-responsible-data-policy/">
          https://www.opentech.fund/about/tos/otf-responsible-data-policy/
        </a>
      </li>
      <li>
        <a href="https://themarkup.org/privacy/">
          https://themarkup.org/privacy/
        </a>
      </li>
    </ul>
    <p>
      We consulted the following guides in drafting our legal inquiry policy:
    </p>
    <ul>
      <li>
        <a href="https://www.eff.org/who-has-your-back-2017">
          https://www.eff.org/who-has-your-back-2017
        </a>
      </li>
      <li>
        <a href="https://wordpress.com/support/report-blogs/legal-guidelines/">
          https://wordpress.com/support/report-blogs/legal-guidelines/
        </a>
      </li>
      <li>
        <a href="http://transparency.automattic.com/">
          http://transparency.automattic.com/
        </a>
      </li>
      <li>
        <a href="https://transparency.automattic.com/national-security/">
          https://transparency.automattic.com/national-security/
        </a>
      </li>
    </ul>
  </Layout>
)
