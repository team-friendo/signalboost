# Overview

Signalboost is a messaging service that allows small groups of admins to send encrypted "broadcast" messages to and receive encrypted "hotline" messages from groups of up to several thousand subscribers over the Signal Messaging Service.

Two of its important design properties are:

1. Admins and subscribers can send encrypted messages to each other without knowing each other's phone numbers or any other personally identifying information about each other
2. If a user's phone is seized or otherwise compromised, no identifying information about the admins or subscribers is leaked to the person who has compromised the phone

We currently achieve these objectives by:

a. Routing messages between admins and subscribers through a proxy signal phone number controlled by the Signalboost server(s)
b. Storing admin and subscriber phone numbers in cleartext membership tables in a postgres database on the Signalboost server (necessary for routing messages and checking admin permissions)
c. Storing key material and other metadata (including user phone numbers) contained in the Signal Protocol Store on Signal Servers (necessary to advance the Signal double-ratchet algorithm between proxy phone numbers and user phone numbers, so that they may exchange messages).

This design leaves valuable metadata about which phone numbers use which Signalboost channels (and, in some cases, when they use the channel) vulnerable to seizure by an adversary who can compromise the Signalboost server either by technical attack, legal compulsion, or social engineering of a project maintainer.

The purpose of this design doc is to design a system for maintaining the above desirable properties of concealing user identities from each other while rendering the system resilient to the above attacks that render it vulnerable to leaking user identities to someone with control of the Signalboost server(s).

We first outline the contours of our security objectives, threat model, and design constraints, then proceed to offer two potential designs to achieve our objectives given our threat model and constraints.

Both designs involve some variation on encrypting user data at rest to the public key of an asymmetric keypair, the private key of which is controlled by users, stored on a client not accessible to the Signalboost server, and transmitted to the server to temporarily decrypt and re-encrypt data on an as-needed basis.

This is intended to be a living document.

Its revision history can be accessed here:

https://0xacab.org/team-friendo/signalboost/-/merge_requests/487/commits

Anyone may offer comment, critique, or suggested revisions here:

https://0xacab.org/team-friendo/signalboost/-/merge_requests/487

# Security Objectives

# Threat Model

## Assets

## Adversaries

## Attacks

# Design Constraints

# Potential Design 1: Client Polling + On-Demand Decryption

# Potential Design 2: Push Notifications to Rotating List of Notificees
