import React from 'react'
import Layout from '../components/layout'

export default () => (
  <Layout>
    <h2>FAQ</h2>
    <ul>
      <li>
        <a href="#why">Why should I use Signalboost?</a>
        <br />
      </li>
      <li>
        <a href="#security">
          How does Signalboost protect my phone number and identity?
        </a>
      </li>

      <li>
        <a href="#secure">How does Signalboost keep my messages secure?</a>
      </li>
      <li>
        <a href="#signal">
          Do I need to be using Signal to use a Signalboost channel?
        </a>
      </li>
      <li>
        <a href="#costl">How much does using Signalboost cost?</a>
      </li>
      <li>
        <a href="#vouche">Can we control who can sign up for our channel?</a>
      </li>
      <li>
        <a href="#opensource">
          Who owns Signalboost? Is Signalboost open-source? Who paid you to make
          Signalboost?
        </a>
      </li>
      <li>
        <a href="#listshare">
          Can I get a list of the subscribers in my Signalboost channel?
        </a>
         
      </li>
      <li>
        <a href="#listshare">
          Can I have a Signalboost channel on the teamfriendo server?
        </a>
         
      </li>
    </ul>
    <h3>
      <span name="why" class="anchor" />
      Why should I use Signalboost?
    </h3>
    <p>
      You should use Signalboost if you want to avoid the high cost of SMS
      blasting and you or your community are already using the secure text
      messaging app Signal. With Signalboost you can use Signal to send messages
      to large groups of other Signal users without them having to expose their
      phone numbers (often a very personal and identifying bit of information)
      to all other group members.  Effectively Signalboost offers free text
      blasting that is secured over Signal.
    </p>
    <h3>
      <span name="security" class="anchor" />
      How does Signalboost protect my phone number and identity?
    </h3>
    <p>
      Signalboost protects your identity by hiding your phone number from others
      members of a channel. Even Admins never see the phone numbers of their
      channel Subscribers. Only the Signalboost server and its maintainers know
      the numbers subscribed to each channels so it is essential that they make
      a commitment to protecting that information.
    </p>
    <h3>
      <span name="secure" class="anchor" />
      How does Signalboost keep my messages secure? 
    </h3>
    <p>
      Just like your phone or anyone you communicate with on Signal, Signalboost
      uses encryption on messages so they can only be read by the intended
      recipients. However, because the Signalboost server is effectively a
      recipient it needs to decrypt messages to be read and then relayed to your
      channel. If a Signalboost server is compromised messages it decrypts could
      be read just like on a compromised phone. However, unlike your phone,
      Signalboost does not keep any record of the messages it sends or receives,
      they are deleted immediately after being relayed, no matter what.
    </p>
    <h3>
      <span name="signal" class="anchor" />
      Do I need to be using Signal to use a Signalboost channel?
    </h3>
    <p>
      Yes. All participants in a Signalboost channel must be using
      Signal. Signal provides both the encryption and delivery mechanism for
      your Signalboost messages.
    </p>
    <h3>
      <span name="cost" class="anchor" />
      How much does using Signalboost cost?
    </h3>
    <p>
      Signalboost is free software and the Signalboost server run by teamfriendo
      is free for communities and organizations we choose to support. Anyone can
      run a Signalboost server and other maintainer may chose to charge for the
      service. Unlike a lot of text messaging apps there is no cost associated
      with sending messages with Signalboost because it leverages Signal to send
      messages instead of costly SMS networks.
    </p>
    <h3>
      <span name="vouche" class="anchor" />
      Can we control who can sign up for our channel?
    </h3>
    <p>
      Yes, Signalboost offers a "vouching" mode. In this mode an invite produced
      either by a Admin or another Subscriber, is required to subscribe to a
      channel.
    </p>
    <h3>
      <span name="opensource" class="anchor" />
      Who owns Signalboost? Is Signalboost open-source?  Who paid you to make
      Signalboost?
    </h3>
     
    <p>
      Signalboost is open-source and free to use. Anyone with the skills and
      desire can set up and run a Signalboost server using our software.
      Signalboost was mostly made without direct funding, as a labor of love.{' '}
      <br />
      <a href="https://0xacab.org/team-friendo/signalboost">
        Check out Signalboost’s code and learn about setting up your own
        instance &#8680;
      </a>
    </p>
    <h3>
      <span name="listshare" class="anchor" />
      Can I get a list of the subscribers in my Signalboost channel?
    </h3>
    <p>
      No. This is an essential feature of Signalboost. Subscribers phone numbers
      are hidden from each other and even from channel Admins. Only Signalboost
      server maintainers could see this data, so you  have to trust
      them. In the case of teamfriendo our privacy policy forbids us sharing
      this information, ever.
    </p>
    <h3>
      <span name="listshare" class="anchor" />
      Can I pay you to add a feature to Signalboost?
    </h3>
    <p>
      Maybe. We are open to being encouraged to add a feature for money if the
      feature is a useful functionality advancement for the communities we hope
      to serve. You can also fork the code and add any features you like (as
      long as your result remains open source) or become a contributor. <br />
      <a href="mailto:team-friendo@riseup.net">
        Email us if you want to talk more about your idea &#8680;
      </a>
    </p>
    <h3>
      <span name="teamfriendo" class="anchor" />
      Can I have a Signalboost channel on the teamfriendo server?
    </h3>
    <p>
      Signalboost is in limited beta and under active development. We are not
      publicly offering channels on our instance at this time. If you would like
      to be considered for our limited beta program you can definitely try{' '}
      <a href="mailto:team-friendo@riseup.net">emailing us</a> to let us know
      about your needs, but you may not get a response because we are busy
      building so we can leave beta soon!
    </p>
  </Layout>
)
