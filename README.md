# Signal Blaster JS

This is a program to allow for subscribable/moderatable text loops overlayed on top of the Signal Secure Messaging service.

# Design

More forthcoming, but the basic idea is this:

1. a `signal-relay` service that relays any message to a given set of recipients (received as JSON) from ...
2. a `signal-dispatch` service, that allows admins to create open/closed channels and users to request to be added to a given channel on a given dispatch server (where each dispatch server has a phone number that controls an authorized signal account)
3. a socket between the services that allows users to send messages to the dispatch service that (if authorized) are forwarded to the relay service and fanned out to all intended recipients on a given channel)

# Hacking

## Getting Started

* Install [blackbox](https://github.com/StackExchange/blackbox#installation-instructions)

```
$ ./bin/install-signal-cli
$ ./bin/blackbox_decrypt_all_files
```
