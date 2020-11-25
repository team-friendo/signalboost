```
CURRENT REVISION AS OF Wed 25 Nov 2020 04:55:02 PM EST
```

# Overview

Signalboost is a messaging service that allows small groups of admins to send encrypted "broadcast" messages to, and receive encrypted "hotline" messages from, groups of up to several thousand subscribers over the Signal Private Messenger service.

Two of its important design properties are:

1. Admins and subscribers can send encrypted messages to each other without knowing each other's phone numbers or any other personally identifying information about each other
2. If a user's phone is seized or otherwise compromised, no identifying information about the admins or subscribers is leaked to the person who has compromised the phone

We currently achieve these objectives by:

1. Routing messages between admins and subscribers through a proxy signal phone number controlled by the Signalboost server(s), which we call a "channel"
2. Storing admin and subscriber phone numbers in cleartext membership tables in a database on the Signalboost server(s) (necessary for routing messages and checking admin permissions)
3. Storing key material and other metadata (including user phone numbers) contained in the Signal Protocol Store on the Signalboost server(s) (necessary to advance the Signal double-ratchet algorithm between proxy phone numbers and user phone numbers, so that they may exchange messages).

This design leaves valuable metadata about which phone numbers use which Signalboost channels (and, in some cases, when they use the channel) vulnerable to seizure by an adversary who can compromise the Signalboost server either by technical attack, legal compulsion, or social engineering of a project maintainer.

The purpose of this design doc is to design a system for maintaining the above desirable properties of concealing user identities from each other while rendering the system resilient to attacks that would leak user identities to someone with control of the Signalboost server(s).

We first outline the contours of our security objectives, threat model, and design constraints, then proceed to offer several candidate designs to achieve our objectives given our threat model and constraints.

All designs involve some variation on encrypting user data at rest to the public key of an asymmetric keypair, the private key of which is encrypted to another (symmetric) key that is controlled by users, stored on a client not accessible to the Signalboost server, and transmitted by the client to the server to temporarily decrypt and re-encrypt data on an as-needed basis. We derive the general schema of this approach from [TREES](https://0xacab.org/liberate/trees), the library that [riseup.net](https://riseup.net) uses to encrypt email contents at rest.

This is intended to be a living document.

Its revision history can be accessed here:

https://0xacab.org/team-friendo/signalboost/-/merge_requests/487/commits

Anyone may offer comment, critique, or suggested revisions here:

https://0xacab.org/team-friendo/signalboost/-/merge_requests/487

# Security Objectives

We wish to:

* Maintain Signalboost's ability to allow users to send encrypted messages to each other over Signal without knowing each other's identities
* Eliminate Signalboost's ability to leak the identities of users by inadvertently disclosing the contents of its filesystem to an adversary

# Threat Model

## Assets

Broadly speaking, there are 2 classes of assets that we wish to defend in this design: Signal Protocol Store data and Signalboost application user data. Both classes contain personally-identifying information about our users (in the form of their phone numbers), and both contain information that could help an adversary determine which groups of people use the same Signalboost channel to communicate with one another.

Use of such "social graph" metadata as leverage to disrupt the activities of a targeted group is a well-documented tactic in efforts to counter political free speech. Since protecting the ability of our users to speak and organize freely is one of our core values, protecting this metadata is of utmost importance to us.

### Signal Protocol Store Data

In order to transmit and encrypt messages using the Signal Protocol, Signalboost servers must implement the Signal Protocol Store, which stores which user (admin or subscriber) phone numbers any given proxy phone number has communicated with, and the key material necessary to encrypt and decrypt messages to those users.

All data in the Signalboost Protocol Store uses a user's phone number as an ID. Linked to that ID are various data such as:

* Ephemeral encryption and decryption keys for sessions between a proxy phone number and a user (which are updated as the key materials "ratchets" forward with each message exchange)
* UUIDs and long-term identity keys ("fingerprints" or "safety numbers") associated with a user's current Signal installation
* Identity keys for each device the user uses to send Signal messages

Depending on the implementation of the Signal Protocol Store, these records may be stored in a way that tracks when they were last updated, which may, in turn, leak information of when a user last used Signal, and by association, Signalboost.

We currently follow the convention of storing the Signal Protocol Store data as JSON blobs on the filesystem, stored in docker-mounted volumes that may be accesed by anyone with root on the Signalboost server.

### Signalboost User Data

In order to route messages and process user-issued commands, Signalboost stores a number of SQL database records that reference user phone numbers. Most notably:
* a `memberships` table that joins a user phone number to a channel phone number (and which may be of type `ADMIN` or `SUBSCRIBER`)
* a `hotlineMessages` table that joins a subscriber phone number to a channel phone number to which that subscriber has recently sent a message (so that admins can reply to that message without learning the subscriber's phone number) which are deleted every 3 days
* an `invites` table that joins a inviting user's phone number to an invited user's phone number and to the channel to which the invitee is being invited -- erased after the invite is accepted/declined or a week passes (whichever is sooner)

We currently store these records in an unencrypted Postgresql database running inside a docker container that may be accessed by anyone with root on the Signalboost server.

## Adversaries

The primary adversary with which we will concern ourselves is a state-level actor with the following capabilities:

* monitor all network traffic
* seize the devices of users or Signalboost maintainers
* issue compulsory legal requests (warrants, subpoenas, court orders, ang gag orders) to Signalboost maintainers
* issue compulsory legal requests to third-party software vendors that Signalboost uses (eg: Twilio)

We are also concerned with a technically-sophisticated civilian adversary with (politically-motivated) animus against our users who has the following capabilities:

* act as administrator and subscriber to an arbitrary set of Signalboost channels
* determine the IP address of the Signal server
* seize the devices of Signalboost maintainers
* launch phishing attacks on Signalboost maintainers


## Attacks

For the purposes of this design, we wish to concern ourselves primarily with attacks that give an adversary access to the data stored on the filesystem of Signalboost servers at rest.

For example, a state actor might legally compel Signalboost maintainers to:
  * gain access to stored on the filesystem of our servers
  * modify our code to capture and peramently record data that is currently only ephemerally held in memory

A technically-sophisticated civilian with animus might phish the Signalboost maintainers in order to gain root on the Signalboost servers which they could use to accomplish the same 2 goals.

For the purposes of this design, we wish to only consider defenses against attacks that would reveal the contents of the Signalboost file system at rest, or what Signalboost currently stores in memory. We do not concern ourselves with defending against attacks that seek to modify our code against our will (either via legal compulsion or intrusion), as we do not think there are any viable technical defenses to these attacks.

We also recognize that there are a variety of account-hijack or impersonation attacks to which the system as designed is currently vulnerable. For example: an adversary with legal compulsion capabilities could compel Twilio to grant control of the Twilio phone number used to authenticate a Signalboost proxy phone number, reauthenticate the number with Signal, and thereby wrest control of a Signalboost channel away from its admins against their will and potentially without their knowledge. While this is a concerning attack, since it does not touch on the assets that we are concerned with defending in this design (namely: metadata containing PII and social graph data about our users), we exclude it from consideration in this document.

# Design Constraints

* All messages between admins and subscribers must be transmitted using the Signalboost protocol
* Messages must be routed from an admin phone number to a proxy phone number controlled by a Signalboost server (aka a "Signalboost channel") to subscriber phone numbers
* All subscribers must receive messages on one of the official Signal clients (Android, IOS, or Desktop) maintained by signal.org
* Admins may use a Signalboost-provided client (desktop or mobile) which can securely store key information and access the Signalboost server over secure network connection.
* Key material between
* A Signalboost server must store the user metadata noted in the "Assets" section above in order to route and encrypt messages
* User metadata must be stored encrypted at rest in a manner that prevents it from being decrypted by a Signalboost maintainer, or by the Signalboost software without use of key material that is not permanently stored on the Signalboost server
* User metadata must be decrypted for the shortest amount of time possible necessary to encrypt and route messages to their recipients
* Decryption using client-provided key material must take place in a manner that creates the least amount of risk of (1) exposing the location or identity of the admin using the client, (2) leaking user data to an attacker who has compromised a client instance

# Provisional Designs

Below, we offer some provisional design proposals that we do not believe to be comprehensive, but which we hope provide an adequate frame of reference within which to debate alternatives and build out an iterative series of designs that progress toward above-specified objectives with increasing levels of rigor and precision. We offer these designs with the hope that they will more precisely elaborate the contours of the problem space, so that readers and collaborators may improve upon them.

No matter what design we ultiamtely adopt, there must be key material to which we encrypt user data, a place to store that key material that is not accessible to the Signalboost server, and a way of transmitting that material to the Signalboost server so that it may temporarily decrypt user data. In the "Foundation" section below, we offer a sketch of a design to satisfy these baseline requirements. In the "Variations" section we move on to consider various mechanisms for transmitting the key material from client to server and between different clients.

## Foundation

### Encryption of user data to key not controlled by server

By default, all identifying user data for a given channel -- by which we mean the rows in the membership table corresponding to a given channel and the serialized data from the Signal Protocol Store, which may either be in database tables or serialized to the filesystem in JSON format -- will be encrypted to the public key of an asymmetric keypair.

The private key of this keypair will be stored on the Signalboost server, but it will be encrypted to a symmetric key that is generated by an external client and is not stored on the server, such that only a client that can provide this secret key material can control the private key and thus decrypt the user data.

Let us call the members of the assymetric keypair EK and DK (for "encryption key" and "decryption key") and the secret key that unlocks the private key of this keypair SK. Whenever a client wishes to perform operations that require access to user metadata (such as routing broadcast messages from admins to subscribers or routing hotline messages from subscribers to admins), it will use the symmetric key SK to decrypt the private key, DK, and use DK to decrypt the relevant user data, which has been encrypted to EK.

All decryption operations will only load cleartext data into memory. At no point will unencrypted data be persisted to disk. When the necessary operations are complete, decrypted key material and user data will be wiped from memory, leaving the only accessible version of the data in an encrypted state.

For ease of communication, we will refer to this process of decrypting key material and user data as "unlocking" and "locking" a channel. There are several possibilities for how and when the unlock/lock cycle may be triggered by a client, which we will address in the "Variations on client-server key transmission" section below.

### Transmission of key from client to server

Admins install a client application, which may run as either a native desktop application or a native Android or IOS app. Upon creation of a new channel, the client application generates secret key material, SK, which is stored locally on the filesystem such that only the client may access it. At the time of channel creation, the client also transmits SK to the Signalboost server so that the server may use it to encrypt the private key, DK, of the keypair to which user and message data for that channel will be encrypted.

All messages to and from Signalboost are composed and displayed in the client. When an admin wishes to send or receive messages, the client connects to the Signalboost server over HTTPS (or any suitably secure network protocol), and transmits the key material necessary to "unlock" the channel as described above.

When a channel with multiple admins is created, or when an existing channel adds a new admin, key material will have to be exchanged between clients in a way that does not require the Signalboost server to already know their identities. There are several variations on how this may happen, which we will address in the "Variations on client-client key transmission" section below.

### Sending broadcast messages

When an admin wishes to send a broadcast message, their client will load SK into memory and transmit it to the Signalboost server. The server will use SK to "unlock" the channel as described above (by first decrypting DK and using it to decrypt date encrypted to EK), allowing it to inspect the membership records for the channel to figure out which phone numbers should receive the broadcast. After sending the broadcast, Signalboost "locks" the channel again (by removing SK and decrypted user data from memory).
q
### Variations on client-server key transmission

#### The problem of Hotline Messages

While the broadcast scenario described above is fairly straightforward, handling hotline messages (messages from subscribers to admins) is more complex. Consider the case in which an unlocked channel receives an incoming hotline message from a subscriber. In order to determine which admins to which it should route the message, Signalboost must consult the membership table to figure out which phone numbers are admins on the channel. However, the membership table containing that information is encrypted to a key that Signalboost does not have, and which only an admin can provide. We are thus deadlocked in a circular dependency: to know who the admins are we need to unlock the channel, but to unlock the channel we need to know who the admins are.

The below two variations offer 2 potential ways to design our way out of this deadlock.

#### Variation 1: Automated Client Polling + As-Needed Decryption

Every time an incoming hotline message is received on a Signalboost channel, it is placed in a queue of incoming messages, and identified with the channel phone number to which it belongs.

On an admin-configurable interval (say, for example, every 5 minutes), the admin client will poll the server and inspect the size of the incoming messages queue. If the queue is empty, nothing happens. If the queue has messages in it, Signalboost requests the secret key material from the client and uses it to unlock the channel, discover the channel admins (from the unlocked database), and transmit all enquued messages to the admins (using the unlocked Signal Protocol Store). After draining the queue and transmitting the messages, it re-locks the channel.

For ease of communication, we will refer to this action of as-needed decryption prompted by a non-tempty message-queue as "mailbox checking" to correspond with an intuition that users already have from using email clients. As with email clients, users may use the Signalboost client to either (1) configure the interval at which their mailbox gets checked, or (2) press a "check now" button to force the client to immediately check the mailbox.

Note: this design allows an unattended client to decrypt user data without explicit manual consent for an admin. This may be acceptable, but deserves further scrutiny and analysis.

#### Variation 2: Push to Clients Over Persistent Connection

Variation 1 has the drawbacks that it (1) does not immediately notify admins of incoming messages and (2) only works if we insist that the client be able to authorized decryption without manual approval from an admin. If we wished to avoid either of those two drawbacks, we could do the following:

When a client wishes to "login" to Signalboost, it estabilishes a persistent duplex connection to the Signalboost server (over a secure Websocket or any other suitable socket protocol). If we wish to obscure the IP address of the admin, we may configure the client to maintain this connection over a Tor circuit. The client authenticates as the admin of a channel by presenting its secret key (SK), which is compared a against a hashed version of SK stored on the server.

The server maintains a lookup table of open socket connections for each channel. When an incoming socket message is received for a given channel, it consults this lookup table and broadcasts an "unlock request" message to all connected clients. If no admins for the channel are currently connected, it enqueues the message and retries it on an interval until a client connects.

##### Variation 2a: manual client-side unlock approval

If we wish to prevent the client from being able to authorize unlocking the channel without explicit approval from an admin, then the "unlock request" from the server will produce a notification in the client application (for example: a popup that says "You have incoming messages. Do you want to unlock the channel to receive them? Yes / No"), which an admin must click on to approve, at which point, the client will transmit SK to the server, which will unlock the channel, and forward all enqueued incoming messages to all admins.

##### Variation 2b: automated client-side unlock approval

If we wish to allow the client to authorize unlocking the channel without user intervention, then anytime an open client app receives an "unlock request" from the Signalboost server, it will respond by transmitting SK to the server, which will use it to unlock the channel and transmit all enqueued messages to all admins.

##### Variation 2c: user-configurable unlock approval

If we wish to allow the user whether to permit the client to approve "unlock requests" unattended, then we could create a configuration toggle in the client that allows the user to specify whether they want the client to operate in "unattended" or "manual approval" mode.

#### Variation 3: Notify Rotating List of Admins + Manually Prompted Decryption

If for whatever reason we wish to avoid the reliance on polling and automated unlocks introduced in Variation 1 or persistence client connections introduced in variation 2, then we need some way of contacting an admin to request the key material necessary to "unlock" the channel to relay incoming messages to admins.

Suppose then, that we relax the restriction that all admin phone numbers must be encrypted at all times and instead create an "on-call rotation" in which a single admin phone number is always stored in cleartext. Every time an incoming message is received, this admin receives a message from the client asking them to authorize the channel to be unlocked. Providing such authorization prompts the client to transmit the secret material to the server necessary to unlock the channel and relay the incoming message to the admins. After the message is relayed, the channel is locked again, and the "on-call" status is rotated to the next admin.

Since there is no guarantee that an admin will immediately respond to a request to unlock the channel, we must still enqueue all incoming messages encrypted to the channel's public key, and only decrypt and relay them once an admin has authorized the channel to be unlocked.

NOTE: while this eliminates the need for automated polling, it leaves at least one admin phone number exposed at all times. Further, while it holds out hopes of transmitting messages more immediately, assuming an attenting "on-call" admin, the possiblity that an admin could be unresponsive could leave the entire channel in a dormant state in which it accumulates enqueued-and-unsent messages. Depending on the amount of time that the channel is allows to remain in this dormant state, it could degrade message transmission responsiveness past a point that is acceptable to most users. We do not really think we should use this variation, but are leaving it in so we can consider all trade-offs! :)

### Variations on client-client key transmission

Whenever Signalboost admins wish to add a new admin to a channel, remove an admin from a channel, or "change the password" to a channel (due to device compromise or because of removing an admin), we want to provide a way to (1) change SK (if needed), (2) transmit the current version of SK to all admins who don't have it.

In all variations below, users may configure how many admins are required to approve a password change or addition/removal of an admin.

#### Variation 1: server-brokered key sharing

For simplicity's sake, we will first consider the case in which a single admin is authorized to update a key or add/remove another admin.

##### For a key change (without voting)

An admin uses the GUI to select "update key." After clicking, a new value of SK (SK1) is generated and sent to the Signalboost server along with the old value of SK (SK0). The server uses SK0 to decrypt DK, then reencrypts DK to SK1. It then hashes and stores SK0, which will no longer be used for decryption purposes, but will be needed to authenticate admins with the old key seeking to rekey. The server will also encrypt SK1 to SK0 and store it on the filesystem, so that it can share the new key with any admins seeking to rekey.

At this point, the server waits for clients to attempt to connect and "unlock" the channel. If we elected to use polling (Variation 1) for client-server key transmission above, this will happen at whatever interval an admin has configured their client to "check the mailbox." If we elected to use a persistent client socket connection (Variation 2), then this will happen whenever an inbound message arrives and the server attempts to ping all connected clients. For our purposes it does not matter how the "unlock" attempt is initiated.

In all cases, when a client attempts to "unlock" a channel, if it has an old key, it will fail to be able to decrypt DK, because it holds an outdated value for SK (SK0 instead of SK1). Whenever a client so attempts and fails, the server will hash the version of SK presented by the client and compare it to the hashes of all known expired versions of SK, which, recall, were created and stored when the rekey event occured.

If it finds a match, the server considers the client a valid admin, and proceeds to use the value of SK0 presented by the client to decrypt the value of SK1 encrypted to SK0 in the rekey event and transmit it back to the client (continuing to retry this transmision until the client acknowledges receipt). Proceeding this way, all clients will eventually

##### For adding and admin (no voting)

An admin uses the GUI to select "add admin." After clicking, the admin is prompted to enter the Signal phone number of the new admin. This number along with SK, are transmitted to the server. The server first (prosaically) "unlocks" the channel so it can record the new admin in the Signalboost memberships table (which will be useful for routing messages once the admin has been authenticated).

Now the server must transmit key material to the new admin, but only after verifying that the admin controls the Signal phone number transmitted by the old admin. To do this, it first generates a secret key to be used analagously to a one-time-passphrase (OTP). The server encrypts the value of SK presented by the old admin to OTP and stores both a hashed version of the OTP and the version of SK encrypted to OTP temporarily on the filesystem. The server then sends the OTP as a Signal message to the admin's phone number from the proxy phone number of the channel to which the new admin is supposed to be granted ownership.

When the admin first installs their client, they will be prompted to enter the phone number of any channels of which they are supposed to be an admin. This informs the client that it should listen for a welcome message containing the OTP. When the admin client receives this welcome message, it parses it for the OTP, then connects to the Signalboost server and presents the OTP to prove it controls the phone number of the admin just added. The server verifies the hash of OTP matches what it has stored, then proceeds to use the OTP to decrypt the value of SK that the old admin left waiting on the server. It transmits SK to the client of the new admin, waits for acknowledgement, and then delets the values of hash(OTP) and Enc(OTP, SK) it had just stored to the filesystem.

##### For removing an admin (no voting)

An admin uses the GUI to select "remove admin." This admin's client generates a new value of SK and used the "password change" flow described to update the shared value of SK. Additionally, it "unlocks" the channel and uses the opportunity to send Signal messages notifying all other admins that the admin has been removed.

##### Voting

Suppose that admins opted to have require approval by more than one admin in order to either change the key for a channel or add/remove another admin. In this case, we will piggy-back on the design for "key change" described above.

However, instead of immediately rotating the key from SK0 to SK1 upon receipt, the server will store the encrypted value of the new SK (as described above) and record a `KEY_ROTATION_REQUESTSED` event in the database. It will then attempt to notify each client of this event (either by pinging connected clients in the persistent-connection model, or waiting for them to "check the mailbox" in the polling version). Whenever an admin connects and is notified of this event, it is asked whether it approves. This "vote" is recorded in a running tally for votes on the event.

Once a user-configured plurality of admins has approved the event, it is "enacted" (via means specified for the no-voting case above) and all admin clients are notified the next time they connect. If a user-configured plurality of admins rejects the event, then all material associated with enacting it is deleted, and all admins are notified of the rejection the next time they attempt to connect.

#### Variation 2: p2p key sharing

We probably don't actually want to do this! Leaving it in in case any readers have great ideas they want to share!!!
