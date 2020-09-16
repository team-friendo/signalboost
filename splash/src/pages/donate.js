import React from 'react'
import Layout from '../components/layout'
import venmoQR from '../images/signalboost_venmo.png'
import bitcoinQR from '../images/signalboost_bitcoin.png'
import Checkout from '../components/stripe.js'

const bitcoinQRStyles = {
  borderRadius: '10px',
  marginLeft: '8px',
}

const platformHeader = {
  color: '#50fa7b',
}

const stripeBtnStyles = {
  marginBottom: '20px',
}

const DonatePage = () => (
  <Layout>
    <h2>Help us build the tech the movement needs.</h2>
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
    <h4 style={platformHeader}>
      If your organization has a tech budget, or if you have the means, consider
      making a recurring donation:
    </h4>
    <div style={stripeBtnStyles}>
      <Checkout
        price="$5"
        priceID={process.env.GATSBY_BUTTON_PRICE_ID_RECURRING_5}
        mode="subscription"
      />
      <Checkout
        price="$20"
        priceID={process.env.GATSBY_BUTTON_PRICE_ID_RECURRING_20}
        mode="subscription"
      />
      <Checkout
        price="$50"
        priceID={process.env.GATSBY_BUTTON_PRICE_ID_RECURRING_50}
        mode="subscription"
      />
    </div>
    <h4 style={platformHeader}>Or make a one-time donation:</h4>
    <div style={stripeBtnStyles}>
      <Checkout
        price="$5"
        priceID={process.env.GATSBY_BUTTON_PRICE_ID_5}
        mode="payment"
      />
      <Checkout
        price="$20"
        priceID={process.env.GATSBY_BUTTON_PRICE_ID_20}
        mode="payment"
      />
      <Checkout
        price="$50"
        priceID={process.env.GATSBY_BUTTON_PRICE_ID_50}
        mode="payment"
      />
    </div>
    <a href="https://venmo.com/signalboost">
      <h4 style={platformHeader}> Venmo: @signalboost</h4>
      <img src={venmoQR} alt="Venmo QR code" height="200" width="225" />
    </a>
    <h4 style={platformHeader}>Bitcoin: 39aSLM1NaPbpvksXjdnWdvVabSM3uYWBDT</h4>
    <img
      style={bitcoinQRStyles}
      src={bitcoinQR}
      alt="Bitcoin QR code"
      height="200"
      width="200"
    />
  </Layout>
)

export default DonatePage
