# Signal Blaster JS

This is a program to allow for subscribable/moderatable text loops overlayed on top of the Signal Secure Messaging service.

# Design

More forthcoming, but the basic idea is this:

1. a `signal-relay` service that relays any message to a given set of recipients (received as JSON) from ...
2. a `signal-dispatch` service, that allows admins to create open/closed channels and users to request to be added to a given channel on a given dispatch server (where each dispatch server has a phone number that controls an authorized signal account)
3. a socket between the services that allows users to send messages to the dispatch service that (if authorized) are forwarded to the relay service and fanned out to all intended recipients on a given channel)

# Hacking

## Getting Started

### Install System Dependencies

*NOTE: for attachment relaying to work, your dev machine will need to be running an outdated version of OpenJDK at runtim. See `JDK Versioning` below for details. (TODO: containerize the app so devs don't have to worry about this!)*

Install blackbox, following [these instructions](https://github.com/StackExchange/blackbox#installation-instructions).

Use it to decrypt secrets with:

```
$ ./bin/blackbox_decrypt_all_files
```

Perhaps you want a different $RELAY_NUMBER. Change it now in `.env`. (Using `blackbox_edit .env`.)

Now let's set up `signal-cli`:

```
$ ./bin/install-signal-cli
$ useradd signal-cli
$ su signal-cli
$ ./bin/register
```

Get the verification code sent to your $RELAY_NUMBER. Set the value of $VERIFICATION_CODE (in `.env`) to this value. And continue...

```
$ ./bin/verify
$ ./bin/configure-dbus
```

Voila! (NOTE: It's important to register/verify as the `signal-cli` user or else you won't be able to run `signal-cli` as a systemd service.)

### Run App

``` shell
$ systemctl start signal-cli
$ yarn start
```

### Test App

With the app running, you can send messages with the following `curl`:

``` shell
curl -i -H 'Content-type: application/json'  \
  -d '{ "message": "this is a test", "recipients": ["+15555555555", "+13333333333"] }' \
  localhost:3000/relay
```

## JDK Versioning

Due to [this known issue](https://github.com/AsamK/signal-cli/issues/143#issuecomment-425360737), you must use JDK 1.8.0 in order for attachment sending to work.

The issue above has okay instructions on how to downgrade your jdk version on debian. For more detailed instructions see [here](https://www.mkyong.com/linux/debian-change-default-java-version/).
