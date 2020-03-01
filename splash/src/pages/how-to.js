import React from 'react'
import Layout from '../components/Layout'
import { Link } from 'gatsby'

export default () => (
  <Layout>
    <p>
      This page is intended primarily for admins who already have Signalboost
      channels. If you need a channel, check out the{' '}
      <Link to="/">Getting Started</Link> section. If you want to know more
      about Signalboost and how secure it is to use, check out the{' '}
      <Link to="/faq">FAQ's.</Link>
    </p>
    <h3>Conceptual overview</h3>
    <p>
      A Signalboost channel has admins and subscribers. Any time an admin sends
      a message to the channel, it is interpreted as a command or an
      announcement. If the message is an announcement, all of the subscribers
      will receive that announcement - notably, the announcement will appear as
      if it is coming from the channel phone number, not the admin who sent it.
    </p>
    <h2>Admin commands</h2>
    <h4>HELP</h4>
    <p>-> lists commands</p>

    <h4>INFO</h4>
    <p>-> shows stats, explains how Signalboost works</p>

    <h4>RENAME new name</h4>
    <p>-> renames channel to "new name"</p>
    <p>Example:</p>

    <h4>DESCRIPTION description of channel</h4>
    <p>-> adds or updates public description of channel</p>

    <h4>INVITE +1-555-555-5555</h4>
    <p>-> invites +1-555-555-5555 to subscribe to the channel</p>

    <h4>ADD / REMOVE +1-555-555-5555</h4>
    <p>-> adds or removes +1-555-555-5555 as an admin of the channel</p>

    <h4>HOTLINE ON / OFF</h4>
    <p>-> enables or disables hotline</p>

    <h4>VOUCHING ON / OFF</h4>
    <p>-> enables or disables requirement to receive an invite to subscribe</p>

    <h4>VOUCH LEVEL level</h4>
    <p>-> changes the number of invites needed to join the channel</p>

    <h4>ESPAÑOL / FRANÇAIS</h4>
    <p>-> switches language to Spanish or French</p>

    <h4>GOODBYE</h4>
    <p>-> leaves this channel</p>

    <h4>DESTROY</h4>
    <p>-> permanently destroys this channel and all associated records</p>

    <h2>Subscriber commands</h2>
    <p>
      Subscribers can send most of the commands admins can, except for commands
      that alter the behavior of a channel.
    </p>
  </Layout>
)
