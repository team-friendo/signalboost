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
      We believe in building ethical tech that doesn't make money from spying on
      you or monetizing your data. Since we make this software for liberation,
      not profit, we rely on the material support of our community to keep the
      project afloat.
    </p>
    <p>
      We are humbled and inspired by the people using Signalboost to organize -
      from protest and occupation organizers to journalists and human rights
      defenders to mental health professionals. We remain deeply committed to
      protecting your digital safety, even if it means we sometimes have to foot
      the bill.
    </p>
    <p>
      It costs us a few bucks per month per channel to keep things up and
      running. Consider writing us into your organization's tech budget or make
      a one-time donation - either way, the funds go towards supporting this
      project and helping other organizers stay safe.
    </p>
    <h3>Support Signalboost here:</h3>
    <h4 style={platformHeader}>Make a recurring donation:</h4>
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
