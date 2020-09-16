import React from 'react'
import { loadStripe } from '@stripe/stripe-js'

const buttonStyles = {
  fontSize: '20px',
  textAlign: 'center',
  color: '#000',
  padding: '12px 25px',
  backgroundColor: '#bd93f9',
  borderRadius: '5px',
  border: 'none',
  margin: '10px',
  cursor: 'pointer',
}

const stripePromise = loadStripe(process.env.GATSBY_STRIPE_PUBLISHABLE_KEY)

const redirectToCheckout = async (event, priceID, mode) => {
  event.preventDefault()
  const stripe = await stripePromise
  const { error } = await stripe.redirectToCheckout({
    lineItems: [{ price: priceID, quantity: 1 }],
    mode,
    successUrl: `https://signalboost.info/donate`,
    cancelUrl: `https://signalboost.info/donate`,
  })

  if (error) {
    console.warn('Error:', error)
  }
}

const Checkout = ({ price, priceID, mode }) => {
  return (
    <button
      style={buttonStyles}
      onClick={e => redirectToCheckout(e, priceID, mode)}
    >
      {price}
    </button>
  )
}

export default Checkout
