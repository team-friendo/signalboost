import React from 'react'
import Layout from '../components/layout'
import venmoLogo from '../images/venmo_logo_blue.png'

const DonatePage = () => (
  <Layout>
    <h2>Help us build the technology the movement needs.</h2>
    <p>
      Over the past year, Signalboost has grown to support 50+ channels with
      over 10,000 subscribers.
    </p>
    <p>
      These channels have coordinated jail support for those recently arrested,
      sent updates on marches to thousands of participants, and have mobilized
      actions, crowdsourced resources, and facilitated food delivery for an
      occupation.
    </p>
    <p>
      We are a collective of technologists dedicated to providing this tool for
      free, without the influence of large corporations. In the past few months
      our users have grown exponentially - increasing our server costs and the
      amount of time we need to spend scaling up.
    </p>
    <h3>Support Signalboost here:</h3>
    <a href="https://venmo.com/signalboost">
      <img src={venmoLogo} width="200" alt="Venmo logo" />
    </a>
  </Layout>
)

export default DonatePage
