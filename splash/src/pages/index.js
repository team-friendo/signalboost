import React from 'react'
import Layout from '../components/layout'
import SEO from '../components/seo'
import { Link } from '@reach/router'
import indexStyles from '../components/index.module.css'
import selfieIcon from '../images/selfie.svg'
import moneyIcon from '../images/money.svg'
import spyIcon from '../images/cute_spy.svg'

const IndexPage = () => (
  <Layout>
    <SEO title="Signalboost: communicate with mass audiences securely and directly via message broadcasts and hotlines" />
    <div className={indexStyles.personas}>
      <img
        className={indexStyles.icon__left}
        src={selfieIcon}
        alt="Venmo QR code"
        height="150"
      />
      <div className={indexStyles.text__right}>
        <h3>Mass alerts for emergency rapid response</h3>
        <p>
          Our democracy is under attack. Mobilize thousands of people to protect
          our civil rights by sending alerts directly to their phones.
        </p>
      </div>
      <div className={indexStyles.text__left}>
        <h3>Private and secure tiplines</h3>
        <p>
          Empower journalists, legal observers, and human rights defenders with
          a safe and lightweight way to receive sensitive tips and requests for
          aid without exposing anyone's identity.
        </p>
      </div>
      <img
        className={indexStyles.icon__right}
        src={spyIcon}
        alt="Venmo QR code"
        height="150"
      />
      <img
        className={indexStyles.icon__left}
        src={moneyIcon}
        alt="Venmo QR code"
        height="150"
      />
      <div className={indexStyles.text__right}>
        <h3>Donation and resource coordination</h3>
        <p>
          In the time of Covid-19 and environmental disaster, give organizers on
          the ground a tool to move resources quickly and safely.
        </p>
      </div>
    </div>

    <h2 className={indexStyles.why__signalboost}>Why use Signalboost?</h2>
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
        subscriber.
      </li>
      <li>
        Subscribers do not see other subscribers' messages to the hotline. Only
        admins can see them.
      </li>
    </ul>
    <h3>Stay safe from surveillance</h3>
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
    <div className={indexStyles.getting__started}>
      <Link className={indexStyles.getting__started__link} to="/how-to">
        Try it out &rarr;
      </Link>
    </div>
    <h2>Questions?</h2>
    <p>
      Check out the <Link to="/faq">FAQ</Link> or{' '}
      <Link to="/how-to">How-To Guide</Link>
    </p>
    <p>
      Write our helpline (on Signal):{' '}
      <span className="purple">+1-947-800-5717</span> or send us an email at{' '}
      <a href="mailto:signalboost@protonmail.com">signalboost@protonmail.com</a>{' '}
      (or, if you prefer old-school:{' '}
      <a href="mailto:signalboost@riseup.net">signalboost@riseup.net</a> +{' '}
      <a href="http://keys.gnupg.net/pks/lookup?search=0xE726A156229F56F1&fingerprint=on&op=index">
        PGP
      </a>
      ).
    </p>
    <p>
      Signalboost is open source, committed to transparency, and cares about
      your digital safety. We encourage you to read the following:{' '}
    </p>
    <ul>
      <li>
        <Link to="/privacy-policy">Privacy Policy</Link>
      </li>
      <li>
        <a href="https://0xacab.org/team-friendo/signalboost">Source code</a>
      </li>
      <li>
        <a href="https://0xacab.org/team-friendo/signalboost/-/wikis/Team-Friendo-Values-and-CoC">
          Code of conduct
        </a>
      </li>
    </ul>
  </Layout>
)

export default IndexPage
