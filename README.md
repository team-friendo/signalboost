# Signalboost

## Table Of Contents:

* [Overview](#overview)
* [Application Design](#design)
* [Administering](#administering)
* [Contributing](#contributing)

# Overview <a name="overview"></a>

**Signalboost** enables users to send free, encrypted text blasts over the [Signal messaging service](https://www.signal.org/) without revealing their phone number to recipients. Developed by and for activists, Signalboost seeks to empower informal networks to communicate safely and rapidly to mass audiences with emergency alerts, urgent announcements, and mobilization updates. [[1](#txtmob_joke)]

**The stack** consists of node services calling out to the [signal-cli](https://github.com/AsamK/signal-cli) Java app over [DBus](https://github.com/freedesktop/dbus). See [Application Design](#design) for a detailed overview.

**Issue tracking and bug reports** live in our [gitlab repo on 0xacab.org](https://0xacab.org/team-friendo/signalboost) You can track **ongoing work** on the [project's kanban board](https://0xacab.org/team-friendo/signalboost/boards).

**Want to use signalboost for social justice work?**  Write us at `team-friendo [AT] riseup [DOT] net`.

__________________

<a name="txtmob_joke"></a>
[1] *If you are a child of the (anarchist) 90's, you might usefully think of signalboost as "Like TXTMOB, but on Signal." If you cut your teeth on Occupy Wall Street, try "Like Celly, but on Signal." If you were born digital, try "Like Signal, but with text blasts."*

# Application Design <a name="design"></a>

## Data Flow

Data flows through the application in (roughly) the following manner:

* an application server controls several signal numbers, each of which acts as a "channel"
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

## A Quirky Thing About the Design

Due to upstream constraints imposed by signal-cli's design, one may not run multiple instances of signal-cli with different phone numbers in daemon mode without creating contention over the underlying dbus interface used to listen to and send messages over signal. (This constraint arises from the fact that the dbus path is hard-coded in the upstream code).

As a temporary workaround to this solution, the `orchestrator` service spins up a docker container containing (1) an instance of the dispatch service, (2) an instance of dbus, and (3) an instance of signal-cli coordinated by supervisord. This eliminates contention over the dbus interface but introduces [memory bloat](https://0xacab.org/team-friendo/signalboost/issues/56) (as 2 JVM's are spun up for each channel.)

It's a less-than ideal fix, but it works for now, and we should soon have an [upstream fix](https://github.com/AsamK/signal-cli/issues/200) in place that makes a more memory-efficient solution possible. :)

# Administering <a name="administering"></a>

## Deploying SignalBoost

### Members of Team Friendo

If you are one of the people maintaining this repo, do the following to provision and deploy signalboost...

#### Initial Deployment

**(1) Load secrets:**

``` shell
$ ./bin/blackbox/decrypt_all_files
$ set -a && source .env && set +a
```

**(2) Obtain a server:**

``` shell
$ ./bin/get-machine
```

**(3) Install ansible dependencies (if needed):**

``` shell
$ ./ansible/install-ansible
```

**(4) Provision and deploy signalboost:**

``` shell
$ cd ansible
$ ansible-playbook -i inventory playbooks/main.yml
```

The last playbook (`harden.yml`) can take as long as 2 hours to run. After `deploy.yml` is finished. Thankfully, you can start using signalboost before it is complete! Just wait for the `deploy.yml` playbook (which will display the task header `Deploy Signalboost`) to complete, and proceed to the following steps:

**(5) Install the `boost` cli tool:**

``` shell
$ cd ..
$ ./cli/install
```

**(6) Provision new twilio phone numbers:**

The below will provision 2 phone numbers in area code 510. (If you omit the `-n` and `-a` flag, boost will provision 1 number in area code 929.)

``` shell
$ boost new_numbers -n 2 -a 510
```

**(7) Provision new signalboost channels:**

Assuming the above returns by printing a success message for the new twilio phone number `+15105555555`, the below would create a channel called `conquest of bread` on that phone number, administered by people with the phone numbers `+151066666666` and `+15107777777`.

``` shell
$ boost new_channel -p +15105555555 -n "conquest of bread" -a "+151066666666,+15107777777"
```

For more commands supported by the `boost` cli tool see the [Administering](#administering) section below.

#### Subsequent Deployments

**(8) Deploy updates to signalboost:**

``` shell
$ cd ansible
$ ansible-playbook -i inventory playbooks/deploy.yml
```

### Friendos of Team Friendo

If you are a person who is not maintaining this repo, we want you to be able to install and maintain your own version of signalboost too! We just can't share our account credentials or server infrastructure with you -- sorry!

We've designed our deploy process so that you should be able to use it with your own credentials and infrastructure with some minor modifications. You should be able to follow all the steps outlined for `Members of Team Friendo` above, substituting the below sections below for their corresponding counterparts above, and get the same results.

(If any of these steps don't work, please don't hesitate to post an issue so we can fix it!)

**(1) Load secrets:**

Create an .env file like the one provided in `.env.example`, but fill in all the values surrounded by `%` marks with actual values:

``` shell
# signal boost api service

SIGNALBOOST_HOST_IP=%IP ADDRESS OF PROD SERVER%
SIGNALBOOST_HOST_URL=%TOP LEVEL DOMAIN NAME FOR PROD SERVER%
SIGNALBOOST_API_TOKEN=%HEX STRING%

# letsencrypt/nginx proxy configs

VIRTUAL_HOST=%TOP LEVEL DOMAIN NAME FOR PROD SERVER%
LETSENCRYPT_HOST=%TOP LEVEL DOMAIN NAME FOR PROD SERVER%
LETSENCRYPT_EMAIL=%EMAIL ADDRESS FOR TEAM SYSADMIN%

# signal-cli

SIGNAL_CLI_VERSION=0.6.2
SIGNAL_CLI_PATH=/opt/signal-cli-0.6.2
SIGNAL_CLI_PASSWORD=%SOME STRONG PASSWORD%

# twilio

TWILIO_ACCOUNT_SID=%HEX STRING%
TWILIO_AUTH_TOKEN=%HEX STRING%


# ngrok

NGROK_AUTH_TOKEN=%HEX_STRING%
NGROK_SUBDOMAIN=%NAME OF CUSTOM SUBDOMAIN REGISTERED WITH NGROK%

```

To generate a decently random 32-byte hex string for your `SIGNALBOOST_API_TOKEN`, you could do the following:

``` shell
$ shuf -i 0-9999999999999999999 -n 1 | sha256sum
```

To get twilio credentials, sign up for a twilio account [here](https://www.twilio.com/try-twilio), then visit the [console page](https://www.twilio.com/console) and look for the `ACCOUNT SID` and `AUTH TOKEN` fields on the righthand side of the page.

You only need an `NGROK_AUTH_TOKEN` and `NGROK_SUBDOMAIN` if you want to run `signalboost` in a local development environment. (To get an ngrok account, visit [here](https://dashboard.ngrok.com/user/signup). See [here](https://dashboard.ngrok.com/reserved) for setting up reserved custom subdomains.)

**(2) Obtain a server:**

To host signalboost, you need a server with a static IP address and a top-level domain with an A record pointing to your IP address.

If you need help finding a server, we'd recommend shopping for a VPS from one the following lovely social-justice oriented groups:

- [Njalla](https://njal.la)
- [Mayfirst](https://mayfirst.org)
- [1984](https://1984.is)
- [Greenhost](https://greenhost.nl)

For domain name registration, we think that [Njal.la](https://njal.la) is hands down the best option.

...

**(3) Provision and deploy signalboost:**

Signalboost is configured through environment variables. Those values are read from the file ".env". There are two ways you can deploy those values using the ansible playbook. You can use either have blackbox install the encrypted version of .env that's bundled with this repo or you can use your own local file.

Add the `-e "deploy_method=blackbox"` flag to instruct ansible to run `bin/blackbox/postdeplogy` on the remote server.

``` shell
$ cd ansible
$ ansible-playbook -i inventory -e "deploy_method=blackbox" playbooks/main.yml
```
...

Add the `-e "deploy_method=copy"` flag to copy a local file containing the environment variables. By default "[REPO-ROOT]/.env" is copied, but that can be configured by setting the ansible variable _deploy_file_.

For example, this will use different environment file:

``` shell
$ cd ansible
$ ansible-playbook -i inventory -e "deploy_method=copy" -e "deploy_file=/path/to/development.env" playbooks/main.yml

```

**(4) Deploy updates to signalboost:**

```

### Install the CLI

Signalboost ships with a cli tool for adding phone numbers, channels, and admins to the service.

Install it with:

``` shell
$ sudo ./cli/install
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
$ git clone git@0xacab.org:team-friendo/signalboost
$ cd signalboost
$ ./bin/blackbox/decrypt_all_files
$ set +a && source .env && set -a
```
#### Friendos of Team-Friendo

If you are not on Team-Friendo, you will need to provide your own values for credentials listed in `.env`. A sample of the values needed is listed in `.env.example`. You should replace all values in `%TEMPLATE_STRINGS` with your own values.

We realize that some of these secrets require paid accounts to work. And that contributing to this project shouldn't require paid accounts! We're trying to come up with a workaround... In the meantime: suggestions welcome! :)

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

### Database scripts

There are a few scripts to do things with the db:

Get a psql shell:

``` shell
$ yarn db:psql
```

Run migrations:

``` shell
$ yarn db:migrate
```

Seed db:

``` shell
$ yarn db:seed
```

Unseed db:

``` shell
$ yarn db:unseed
```

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
