import React from 'react'
import { Link } from 'gatsby'

import Layout from '../components/layout'
import SEO from '../components/seo'

const IndexPage = () => (
  <Layout>
    <SEO title="Signalboost: Secure Textblasts and Hotlines for Activists" />
    <p>
      Signalboost lets activists use Signal to send text blasts and receive
      hotline tips on their phones without revealing their identity or spending
      money. <br />
      It is <em style={{ color: '#ff79c6' }}>secure, simple, and free.</em>
    </p>

    <h3>Secure:</h3>
    <ul>
      <li>
        Signalboost sends messages over <a href="https://signal.org">Signal</a>,
        the most secure encrypted messaging service available for phones.
      </li>
      <li>
        It does not display phone numbers or names. People can send and receive
        messages without sharing their identity -- and feel safer if anyone's
        phone is stolen.
      </li>
      <li>
        Signalboost retains the minimal user metadata necessary to route
        messages. Its maintainers, Team Friendo, will resist any attempt to
        compel us disclose it, and are working on{' '}
        <a href="https://0xacab.org/team-friendo/signalboost/issues/68">
          updates
        </a>{' '}
        make such disclosure impossible.
      </li>
    </ul>

    <h3>Simple:</h3>
    <ul>
      <li>
        Signalboost is for 1-way messaging only. Admins can send announcements
        to large groups and receive hotline tips from anyone. That's it.
      </li>
      <li>
        It does not allow subscribers to send messages to each other. This cuts
        out cross talk endemic to large Signal or WhatsApp groups.
      </li>
      <li>
        It tries to solve one problem and solve it well. This makes it easier to
        know what it's for amidst a dizzying sea of tech tools!
      </li>
    </ul>

    <h3>Free:</h3>
    <ul>
      <li>
        We are making this software for people's collective liberation, not for
        profit. We do not charge money for it and never will.
      </li>
    </ul>

    <h1>Getting Started</h1>

    <h3>To get a Signalboost channel:</h3>
    <ul>
      <li>
        Send a Signal message to{' '}
        <span style={{ color: '#bd93f9' }}>+1-938-444-8536</span>.
      </li>
      <li>
        Include a name for the channel and the phone numbers of all admins.
      </li>
      <li>
        You will receive a welcome message as soon as your channel is created.
      </li>
    </ul>

    <h3>Once you have a channel:</h3>
    <ul>
      <li>
        There will be a signal phone number associated with your channel.
        Anytime you send a message to it, anyone who is subscribed will get that
        message.
      </li>
      <li>
        People can subscribe to announcements by sending a Signal message to
        this phone number that says "HELLO", "HOLA" or "ALLÔ" and leave by
        sending "GOOBYE", "ADIÓS" or "ADIEU."
      </li>
      <li>
        Signalboost speaks English, French and Spanish and everyone can choose
        which language they want to use for commands and notifications. Send a
        Signal message to the channel that says "HELP" to see the command
        options.
      </li>
      <li>
        You can convert the channel into a hotline by sending a message that
        says "HOTLINE ON" to your channel number.
      </li>
    </ul>

    <h1>Got questions?</h1>
    <ul>
      <li>
        Send us a signal message at{' '}
        <span style={{ color: '#bd93f9' }}>+1-938-444-8536</span>
      </li>
      <li>
        Send us an email at{' '}
        <a href="mailto:team-friendo@protonmail.com">
          team-friendo@protonmail.com
        </a>{' '}
        or <a href="mailto:team-friendo@riseup.net">team-friendo@riseup.net</a>
      </li>
      <li>
        Find our{' '}
        <a href="http://keys.gnupg.net/pks/lookup?search=0xE726A156229F56F1&fingerprint=on&op=index">
          PGP key here
        </a>
      </li>
      <li>
        Visit our&nbsp;
        <a href="https://0xacab.org/team-friendo/signalboost">gitlab page</a>
        &nbsp;to learn more technical details, read our source code, request a
        new feature, report a bug, or become a contributor!
      </li>
    </ul>
    <h1>FAQ</h1>
    <ul>
    	<li>
			<a href="#why">Why should I use Signalboost?</a><br/>
		</li>
		<li>
			<a href="#security">How does Signalboost protect my phone number and identity?</a>
		</li>
		
		<li>
			<a href="#secure">How does Signalboost keep my messages secure?</a>
		</li>
		<li>
			<a href="#signal">Do I need to be using Signal to use a Signalboost channel?</a>
		</li>
		<li>
			<a href="#costl">How much does using Signalboost cost?</a>
		</li>
		<li>
			<a href="#vouche">Can we control who can sign up for our channel?</a>
		</li>
		<li>
			<a href="#opensource">Who owns Signalboost? Is Signalboost open-source? Who paid you to make Signalboost?</a>
		</li>
		<li>
			<a href="#listshare">Can I get a list of the subscribers in my Signalboost channel?</a> 
		</li>
		<li>
			<a href="#listshare">Can I have a Signalboost channel on the teamfriendo server?</a> 
		</li>	    			
	</ul>
    
    <h3><span name="why" class="anchor"></span>Why should I use Signalboost?</h3>
    <p>You should use Signalboost if you want to avoid the high cost of SMS blasting and you or your 
    community are already using the secure text messaging app Signal. With Signalboost you can use Signal 
    to send messages to large groups of other Signal users without them having to expose their 
    phone numbers (often a very personal and identifying bit of information) to all other group members. 
    Effectively Signalboost offers free text blasting that is secured over Signal.
    </p>
    <h3><span name="security" class="anchor"></span>How does Signalboost protect my phone number and identity?</h3>
    <p>Signalboost protects your identity by hiding your phone number from others members of a 
    channel. Even Admins never see the phone numbers of their channel Subscribers. Only the 
    Signalboost server and its maintainers know the numbers subscribed to each channels so it is 
    essential that they make a commitment to protecting that information. 
    </p>
    <h3><span name="secure" class="anchor"></span>How does Signalboost keep my messages secure? </h3>
    <p>Just like your phone or anyone you communicate with on Signal, Signalboost uses encryption on 
    messages so they can only be read by the intended recipients. However, because the Signalboost 
    server is effectively a recipient it needs to decrypt messages to be read and then relayed to your 
    channel. If a Signalboost server is compromised messages it decrypts could be read just like on 
    a compromised phone. However, unlike your phone, Signalboost does not keep any record of the 
    messages it sends or receives, they are deleted immediately after being relayed, no matter what.
	</p>
    <h3><span name="signal" class="anchor"></span>Do I need to be using Signal to use a Signalboost channel?</h3>
    <p>Yes. All participants in a Signalboost channel must be using Signal. Signal provides both 
    the encryption and delivery mechanism for your Signalboost messages. 
    </p>
    <h3><span name="cost" class="anchor"></span>How much does using Signalboost cost?</h3>
    <p>Signalboost is free software and the Signalboost server run by teamfriendo is free for 
    communities and organizations we choose to support. Anyone can run a Signalboost server 
    and other maintainer may chose to charge for the service. Unlike a lot of text messaging 
    apps there is no cost associated with sending messages with Signalboost because it leverages 
    Signal to send messages instead of costly SMS networks. 
    </p>
    <h3><span name="vouche" class="anchor"></span>Can we control who can sign up for our channel?</h3>
	<p>Yes, Signalboost offers a "vouching" mode. In this mode an invite produced either by a Admin or 
	another Subscriber, is required to subscribe to a channel.
	</p>
	<h3><span name="opensource" class="anchor"></span>Who owns Signalboost? Is Signalboost open-source? Who paid you to make Signalboost?</h3> 
	<p>Signalboost is open-source and free to use. Anyone with the skills and desire can set up and run a 
	Signalboost server using our software. Signalboost was mostly made without direct funding, as a labor of love. <br />
	<a href="https://0xacab.org/team-friendo/signalboost">Check out Signalboost’s code and learn about setting up your own instance &#8680;</a>
	</p>
	<h3><span name="listshare" class="anchor"></span>Can I get a list of the subscribers in my Signalboost channel?</h3>
	<p>No. This is an essential feature of Signalboost. Subscribers phone numbers are hidden from each 
	other and even from channel Admins. Only Signalboost server maintainers could see this data, so you 
	have to trust them. In the case of teamfriendo our privacy policy forbids us sharing this information, ever. 
	</p>
	<h3><span name="listshare" class="anchor"></span>Can I pay you to add a feature to Signalboost?</h3>
	<p>Maybe. We are open to being encouraged to add a feature for money if the feature is a useful functionality 
	advancement for the communities we hope to serve. You can also fork the code and add any features you like 	
	(as long as your result remains open source) or become a contributor. <br />
	<a href="mailto:team-friendo@riseup.net">Email us if you want to talk more about your idea &#8680;</a>
	</p>
	<h3><span name="teamfriendo" class="anchor"></span>Can I have a Signalboost channel on the teamfriendo server?</h3>
	<p>Signalboost is in limited beta and under active development. We are not publicly offering channels on 
	our instance at this time. If you would like to be considered for our limited beta program you can 
	definitely try <a href="mailto:team-friendo@riseup.net">emailing us</a> to let us know about your needs, 
	but you may not get a response because we are busy building so we can leave beta soon! </p>
  </Layout>
)

export default IndexPage
