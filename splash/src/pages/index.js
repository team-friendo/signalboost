import React from 'react'
import Layout from '../components/layout'
import SEO from '../components/seo'
import { Link } from '@reach/router'
import indexStyles from '../components/index.module.css'
import {
  spyIcon,
  selfieIcon,
  moneyIcon,
  calyxLogo,
  emersonLogo,
  mozillaLogo,
} from '../images/'

const IndexPage = () => (
  <Layout>
    <SEO title="Signalboost: communicate with mass audiences securely and directly via message broadcasts and hotlines" />
    <p className={indexStyles.outageAlert}>
      *******************************************
    </p>
    <h2 className={indexStyles.outageAlert}>OUTAGE ALERT</h2>
    <p>
      Signalboost is currently experiencing a systemwide outage. We are
      investigating the cause of the problem, which we suspect to be related to
      recent upstream changes in the Signal service introduced to combat
      spammers. We hope to get the system back up and running as soon as we can,
      but suspect it might take several days.{' '}
    </p>
    <p>
      We care very deeply about supporting the work our amazing users do, so the
      prospect of a prolonged outage makes us as deeply sad and frustrated as it
      might make you. As such, you can rest assured, we will be working as hard
      as we can to get things back up and running as soon as is possible under
      the circumstances! Stay tuned here for any updates.1
    </p>
    <p className={indexStyles.outageAlert}>
      *******************************************
    </p>

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
        <h3>
          Anonymous<Link to="/privacy">*</Link> tiplines
        </h3>
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
    <h3>Signalboost is supported by:</h3>
    <div className={indexStyles.funders}>
      <img
        className={indexStyles.funder__logo_moz}
        src={mozillaLogo}
        alt="mozilla logo"
      />
      <img src={emersonLogo} alt="emerson logo" />
      <img src={calyxLogo} height="130" alt="calyx logo" />
    </div>
  </Layout>
)

export default IndexPage
