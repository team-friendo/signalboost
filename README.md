# Signalboost

## Table Of Contents:

* [Overview](#overview)
* [Administering](#administering)
* [Contributing](#contributing)
* [Application Design](#design)

# Overview <a name="overview"></a>

Signalboost provides provides free, subscribable, encrypted mass text blasts over the [signal messaging service](https://www.signal.org/). (If you are a child of the anarchist 90's, you might usefully think of it as "TextMob 2020." ;))

It is being made for and in consultation with frontline activists to help them quickly and safely alert friends to mobilize in emergency situations.

The stack is a fun mix of node services, dynamically-allocated docker containers, dbus interfaces, and calls to the [signal-cli](https://github.com/AsamK/signal-cli) Java app. See [Application Design](#design) for more details.

If you found us on github, note that all **issue-tracking** takes place via gitlab at [https://0xacab.org/team-friendo/signalboost](https://0xacab.org/team-friendo/signalboost).

If you are a social justice group and **want to use signalboost for your work**, please write us at `team-friendo [AT] riseup [DOT] net`. (Signal number and PGP key for inquiries forthcoming! :))

# Administering <a name="administering"></a>

## Deploying a new SignalBoost instance

*(TK-TODO: lots of ansible goodness forthcoming!)*

## Managing an existing SignalBoost instance

### Install the CLI

Signalboost ships with a cli tool for adding phone numbers, channels, and admins to the service.

Install it with:

``` shell
$ ./cli/install_boost_cli
```

*(NOTE: This will add a path to the `./cli` directory to your $PATH. If you prefer to not do that, you can invoke the cli as `./cli/boost` instead of just `boost`)*

### Use the CLI

You can administer any running signalboost instance with:

``` shell
$ boost <command> <options>
```

Where `<command>` is one of the following:

``` shell
  help
    - shows this dialogue

  new_channel -p <chan_phone_number> -n <chan_name> -a <admins> -u <api_url>
    - activates a channel with provied phone number, name, and admins via api at provided url

  new_numbers -a <area_code> -n <numbers_desired> -u <api_url>
    - purchases n new twilio numbers and registers them w/ signal via api at provided url

  list_numbers
    - lists all numbers purchased from twilio (no channel info included)

  release_number <sid>
    - releases a twilio number with the given sid

  release_numbers <path>
    - releases all twilio numbers with sids listed at given path
```

For more detailed instructions on any of the commands, run:

``` shell
$ boost <command> -h
```

# Contributing <a name="contributing"></a>

## Getting Started

### Secrets

Upon cloning the repo, do either of the following to provide missing env vars needed to run signalboost:

#### Team-Friendo Members

We use [blackbox](https://github.com/StackExchange/blackbox) to keep secrets under encrypted version control.

Use it to decrypt secrets and source them with:

```
$ git clone git@0xacab.org:team-friendo/signal-boost
$ cd signal-boost
$ ./bin/blackbox/decrypt_all_files
$ set +a && source .env && set -a
```
#### Friendos of Team-Friendo

If you are not on Team-Friendo, you will need to provide your own values for credentials listed in `.env`.

A sample of the values needed is listed in `.env.example`:

``` shell
SIGNAL_BOOST_HOST_IP=%IP_ADDRESS_OF_PROD_SERVER%
SIGNAL_BOOST_API_TOKEN=%SOME_RANDOM_64_BYTE_HEX_STRING%
SIGNAL_CLI_VERSION=0.6.2
SIGNAL_CLI_PATH=/opt/signal-cli-0.6.2
SIGNAL_CLI_PASSWORD=%SOME_STRONG_PASSWORD%
TWILIO_ACCOUNT_SID=%34_BYTE_HEX_STRING%
TWILIO_AUTH_TOKEN=%32_BYTE_HEX_STRING%
NGROK_AUTH_TOKEN=%43_BYTE_HEX_STRING%
```
You should replace all values in `%TEMPLATE_STRINGS` with your own values.

Yes! We realize that some of these secrets require paid accounts to work. And that contributing to this project shouldn't require paid accounts! We're trying to come up with a workaround... In the meantime: suggestions welcome! :)

### Setup

``` shell
$ yarn setup
```

### Run Tests

``` shell
$ yarn test
```

If you want, you can run unit and e2e tests separately:

``` shell
$ yarn test:unit
```

``` shell
$ yarn test:e2e
```

### Run App

Run the app in dev mode with:

``` shell
$ yarn dev
```

### Use App

With the app running...

Any human should be able to:

* Join the channel by sending a signal message with contents "JOIN" to `$CHANNEL_PHONE_NUMBER`
* Leave the channel by sending a signal message with contents "LEAVE" to `$CHANNEL_PHONE_NUMBER`

Any admin should be able to:

* Broadcast a message to all channel subscribers by sending it to `$CHANNEL_PHONE_NUMBER`
* Receive all messages broadcast to the channel

### Check logs

You can check the logs with:

``` shell
$ cat ./logs/<service>.log.0
$ cat ./logs/<service>.err.0
```

Where `<service>` is one of:

* `dbus`
* `dispatcher`
* `orchestrator`
* `signal-cli`

### Check status of sub-services

You can check the status of a any sub-service of the dispatcher service with:

``` shell
$ docker-compose exec signalboost_dispatcher "supvervisord ctl status"
```

Where the monitored subservices include:

* `dbus`
* `dispatcher`
* `signal-cli`

# Application Design <a name="design"></a>

## Data Flow

Data flows through the application in (roughly) the following manner:

* there is an application that controls several signal numbers, each of which acts as a "channel"
* admins and other humans can interact with the channel by sending it commands in the form of signal messages. for example: humans may subscribe and unsubscribe from a channel by sending a signal message to it that says "JOIN" or "LEAVE" (respectively). admins can add other admins my sending a message that says "ADD +15555555555", etc.
* when an admin sends a non-command message to a channel, the message is broadcast to all humans subscribed to that channel
* unlike with signal groups:
  * the message appears to the subscribers as coming from the phone number associated with the channel (not the admin).
  * subscribers may not see each others' phone numbers
  * subscribers may not respond to messages
* unlike with text blast services:
  * messages are free to send! (thanks m0xie!)
  * messages are encrypted between admins and the application and between the application and subscribers (NOTE: they are decrypted and reencrypted momentarily by the application but are not stored permanetly on disk)
  * admins may send attachments to subscribers

## Architecture

The application has the following components:

* a `channelRepository` service that keeps track of what channels exist, what admins may send to them, and what humans are subscribed to them
* a `message` service that controls a set of signal numbers and can send and receive signal messages as those numbers via the dbus interface exposed by `signal-cli` (running in daemon mode as a systemd service).
* a `dispatch` service that reads incoming messages and either forwards them to the `message` services, or to the `commmand` service based on the message content and a set of permissions defined by queries to the `channelRespository` (where permissions, etc. are encoded)
* an `orchestrator` service that handles the provision of new `dispatch` services as new channels are created
