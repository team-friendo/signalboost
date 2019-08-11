# Signalboost

## Table Of Contents:

* [Overview](#overview)
* [Application Design](#design)
* [Deploying A Signalboost Instance](#deploy)
  * [Deploy Instructions for General Public](#deploy-public)
  * [Deploy Instructions for Maintainers](#deploy-maintainers)
* [Using the Signalboost CLI Tool](#cli)
* [Contributing](#contributing)

# Overview <a name="overview"></a>

**Signalboost** is a rapid response tool made by and for activists. It enables users to send encrypted text alerts over the [Signal messaging service](https://www.signal.org/) to mass subscriber lists without revealing the sender's phone number to recipients or recipients' phone numbers to each other -- for free. You could use it to send emergency alerts, mobilization updates, urgent requests for aid, or other inventive usages we never could have thought of! :) [[1](#txtmob_joke)]

**The stack** consists of node services calling out to the [signald](https://git.callpipe.com/finn/signald) Java app over unix sockets. See [Application Design](#design) for a detailed overview.

**Issue tracking and bug reports** live in our [gitlab repo on 0xacab.org](https://0xacab.org/team-friendo/signalboost) You can track **ongoing work** on the [project's kanban board](https://0xacab.org/team-friendo/signalboost/boards).

**Want to use signalboost for social justice work?**  Write us at `team-friendo [AT] riseup [DOT] net` ([pgp key here](https://pgp.mit.edu/pks/lookup?op=get&search=0xE726A156229F56F1)) to request a signalboost channel for your group. We're also happy to help you learn how to install and maintain your own instance of a signalboost sever so you can run your own channel and not trust team-friendo with storing your subscriber list(s). :)

**NOTE: this project is not officially affiliated with the Signal App or Foundation.** We are just some humble rad techies trying to help our friends. We are grateful to Moxie and the Signal Foundation for maintaining a generous free/open ecosystem that makes projects like this possible. <@3
__________________

<a name="txtmob_joke"></a>
[1] *If you are a child of the (anarchist) 90's, you might usefully think of signalboost as "Like TXTMOB, but on Signal." If you cut your teeth on Occupy Wall Street, try "Like Celly, but on Signal." If you were born digital, try "Like Signal, but with text blasts."*

# Application Design <a name="design"></a>

## Data Flow

Data flows through the application in (roughly) the following manner:

* an application server controls several signal numbers, each of which acts as a "channel"
* publishers and subscribers can interact with the channel by sending it commands in the form of signal messages. for example: people may subscribe and unsubscribe from a channel by sending a signal message to it that says "JOIN" or "LEAVE" (respectively). publishers can add other publishers by sending a message that says "ADD +1-555-555-5555", etc.
* when a publisher sends a non-command message to a channel, the message is broadcast to all subscriber on that channel
* unlike with signal groups:
  * the message appears to the subscribers as coming from the phone number associated with the channel (not the publisher).
  * subscribers may not see each others' phone numbers
  * subscribers may not respond to messages
* unlike with text blast services:
  * messages are free to send! (thanks m0xie!)
  * messages are encrypted between publishers and the application and between the application and subscribers (NOTE: they are decrypted and reencrypted momentarily by the application but are not stored permanetly on disk)
  * publishers may send attachments to subscribers
* notably: the list of subscribers is currently stored on disk on the signalboost server. if this makes you nervous, you can:
  * host your own instance of signalboost (see docs below)
  * register your desire for us to implement encrypted subscriber tables in the [issue tracker](https://0xacab.org/team-friendo/signalboost/issues/68)

## Architecture

The application has the following components:

1. a `db` layer with:
  * a `phoneNumbersRepository`: tracks what twilio phone numbers have been purchased, whether they have been registered with signal, and whether they are being used for a channel
  * a `channelsRepository`: keeps track of what channels exist on what phone numbers, and who is publishing or subscribed to any given channel
2. a `registrar` service that:
  * searches for and purchases twilio phone numbers
  * registers twilio phone numbers with signal
  * sends verification codes to signal server (after receiving verification codes sent as sms messages from signal server to twilio, relayed to the app at an incoming `/twilioSms` webhook)
  * creates channels and adds/removes phone numbers, publishers, and subscribers to/from them
3. a `dispatcher` service that reads incoming messages on every channel via unix socket connection to `signald`, then processes each message with both:
   * the `executor` subservice parses message for a command (e.g, `ADD` a publisher to a channels). if it finds one,
 it executes the command and returns response message.
   * the `messenger` subservice handles the output from the executor. if it sees a command response it sends it to the command issuer. else it broadcasts incoming messages to channel subscribers if access control rules so permit.

# Deploying A SignalBoost Instance <a name="deploy"></a>

## Deploy Instructions for General Public <a name="deploy-public"></a>

If you are a person who is not maintaining this repo, we want you to be able to install and maintain your own version of signalboost too! We just can't share our account credentials or server infrastructure with you -- sorry!

We've designed our deploy process so that you should be able to use it with your own credentials and infrastructure with some minor modifications. (If any of these steps don't work, please don't hesitate to post an issue so we can fix it!)

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


# ngrok (only needed to run on a local dev machine, skip if you just want to run in prod)

NGROK_AUTH_TOKEN=%HEX_STRING%
NGROK_SUBDOMAIN=%NAME OF CUSTOM SUBDOMAIN REGISTERED WITH NGROK%

```

To generate a decently random 32-byte hex string for your `SIGNALBOOST_API_TOKEN`, you could do the following:

``` shell
$ python
>>> import secrets
>>> secrets.token_hex(32)
```

To get twilio credentials, sign up for a twilio account [here](https://www.twilio.com/try-twilio), then visit the [console page](https://www.twilio.com/console) and look for the `ACCOUNT SID` and `AUTH TOKEN` fields on the righthand side of the page.

You only need an `NGROK_AUTH_TOKEN` and `NGROK_SUBDOMAIN` if you want to run `signalboost` in a local development environment. (To get an ngrok account, visit [here](https://dashboard.ngrok.com/user/signup). See [here](https://dashboard.ngrok.com/reserved) for setting up reserved custom subdomains.)

**(2) Obtain a server:**

To host signalboost, you need a server that:

* is running either the Debian or Ubuntu GNU/Linux distributions
* has a static IP address assigned to it
* has a top-level domain with an A record pointing to that static IP address

If you need help finding a server, we'd recommend shopping for a VPS from one the following lovely social-justice oriented groups:

- [Njalla](https://njal.la)
- [Greenhost](https://greenhost.nl)
- [1984](https://1984.is)
- [Mayfirst](https://mayfirst.org)

For domain name registration, we think that [Njal.la](https://njal.la) is hands down the best option.

**(3) Install ansible dependencies:**

``` shell
$ ./ansible/install-ansible
```

**(4) Provision and deploy signalboost:**

This step uses ansible to provision a server, install signalboost and all of its dependencies, then deploy and run signalboost.

It uses four playbooks (all of which can be found in the `ansible/playbooks` directory):

1. `provision.yml` (sets up users and system dependencies, performs basic server hardening)
1. `deploy.yml` (builds signalboost docker containers, installs and runs signalboost inside of them)
1. `harden.yml` (performs advanced server hardening -- takes a long time!)

You can run all playbooks with one command:

``` shell
$ cd ansible
$ ansible-playbook -i inventory playbooks/main.yml
```

*Variation:*

By default the secrets needed to run signalboost (including ip addresses and hostnames) are read from `<PROJECT_ROOT>/.env>` If you would like to provide an alternate set of secrets (for example, for a staging server), you can configure the location where ansible will look for the `.env` file by setting the `env_file` ansible variable (specified with an `-e env_file=<some_path>` flag). For example, to read secrets from `/path/to/staging.env`, you would issue the following command:

``` shell
$ cd ansible
$ ansible-playbook -e "env_file=/path/to/staging.env" playbooks/main.yml
```

**(5) Install the `boost` CLI tool:**

Signalboost ships with a cli tool for adding phone numbers, channels, and admins to the service.

Install it with:

``` shell
$ sudo ./cli/uninstall
```

*(NOTE: This will add a symlink to `./cli` directory to your `/usr/bin` directory. If you prefer to not do that, you can invoke the cli as `./cli/boost` instead of just `boost`, but you must take care to always be in the `<PROJECT_ROOT>` directory when/if you do that.)*

**(6) Provision new twilio phone numbers:**

The below will provision 2 phone numbers in area code 510. (If you omit the `-n` and `-a` flag, boost will provision 1 number in area code 929.)

``` shell
$ boost new_numbers -n 2 -a 510
```

**(7) Provision new signalboost channels:**

Assuming the above returns by printing a success message for the new twilio phone number `+15105555555`, the below would create a channenewl called `conquest of bread` on that phone number, administered by people with the phone numbers `+151066666666` and `+15107777777`.

``` shell
$ boost new_channel -p +15105555555 -n "conquest of bread" -a "+151066666666,+15107777777"
```

For more commands supported by the `boost` cli tool see the [Administering](#administering) section below.

**(8) Deploy updates to signalboost:**

On subsequent (re)deployments, you do not need to run the `provision`, `configure`, or `harden` playbooks. Instead you can just run:

``` shell
$ cd ansible
$ ansible-playbook -i inventory playbooks/deploy.yml
```

## Deploy Instructions for Maintainers <a name="deploy-maintainers"></a>

If you are a member of `team-friendo`, here are instructions on how to provision, deploy, and maintain a running signalboost instance. :)

*NOTE: If you are administering an already-existent signalboost instance, you can omit steps 3 and 4.*

#### Initial Deployment

**(1) Load secrets:**

``` shell
$ cd /path/to/signalboost
$ ./bin/blackbox/decrypt_all_files
$ set -a && source .env && set +a
```

*NOTE: we use [blackbox](https://github.com/StackExchange/blackbox) for pgp-based credentials management. It is provided in `signalboost/bin/` as a convenience.

If you would like to install your own version of blackbox you can do that with:*

``` shell
git clone git@github.com:StackExchange/blackbox
cd blackbox
make copy-install
```

For other installation options, see: https://github.com/StackExchange/blackbox#installation-instructions

**(2) Install ansible dependencies:**

``` shell
$ ./ansible/install-ansible
```

*NOTE: This will install [ansible](https://www.ansible.com/) itself and the docker and pip roles we use in our playbooks.*


**(3) Obtain a server:**

*NOTE: If you are administering an already-existing signalboost instance, omit this step and skip straight to Step 5  ! :)*

``` shell
$ ./bin/get-machine
```

**(4) Provision and deploy signalboost:**

*NOTE: If you are administering an already-existing signalboost instance, omit this step and skip straight to Step 5  ! :)*

``` shell
$ cd ansible
$ ansible-playbook -i inventory playbooks/main.yml
```

*Variation 1:* The above will deploy secrets by copying them from `<PROJECT_ROOT>/.env` on your local machine. If you would like to copy them from elsewhere, provide alternate path to the `deploy_file` ansible variable (specified with an `-e deploy_file=<...>` flag). For example, to copy environment variables from `/path/to/development.env`, run:

``` shell
$ cd ansible
$ ansible-playbook -i inventory playbooks/main.yml -e env_file /path/to/development.env
```

*Variation 2:*: If you would like to deploy secrets by decrypting the copy of `.env.gpg` under version control (and thus more likely to be up-to-date), add the `-e "deploy_method=blackbox"` flag. For example:

``` shell
$ cd ansible
$ ansible-playbook -i inventory playbooks/main.yml -e deploy
```

*Timing Note:* The last playbook (`harden.yml`) can take as long as 2 hours to run. After `deploy.yml` is finished. Thankfully, you can start using signalboost before it is complete! Just wait for the `deploy.yml` playbook (which will display the task header `Deploy Signalboost`) to complete, and proceed to the following steps...

**(5) Install the `boost` cli tool:**

We have a cli tool for performing common sysadmin tasks on running signalboost instances. You can install it by using the following script (which will put the `boost` command on your $PATH by adding a symlink in `/usr/bin`, which is why it needs root):

``` shell
$ cd <path/to/signalboost>
$ sudo ./cli/install
```
The main use of this tool is to:

1. provision new twillio phone numbers and authenticate them with signal
2. deploy already-authenticated phone numbers for use as signalboost channels
3. list already-provisioned numbers and already-deployed channels

You can uninstall it later with:

```shell
$ cd <path/to/signalboost>
$ sudo ./cli/install
```

**(6) List existing numbers/channels:**

You can check out what numbers and channels already exist with:

```shell
$ boost list-numbers
$ boost list-channels
```

**(7) Provision new twilio phone numbers:**

The below will provision 2 phone numbers in area code 510:

``` shell
$ boost create-number -n 2 -a 510
```

*NOTE: If you omit the `-n` and `-a` flag, boost will provision 1 number with a non-deterministic area code.*

**(8) Provision new signalboost channels:**

Assuming the above returns by printing a success message for the new twilio phone number `+15105555555`, the below would create a channel called `conquest of bread` on that phone number, and set the phone numbers `+151066666666` and `+15107777777`as senders on the channel.

``` shell
$ boost create-channel -p +15105555555 -n "conquest of bread" -s "+151066666666,+15107777777"
```

For more commands supported by the `boost` cli tool see the [Administering](#administering) section below.

**(9) Deploy updates to signalboost:**

On subsequent (re)deployments, you do not need to run the `provision`, `configure`, or `harden` playbooks. Instead you can just run:

``` shell
$ cd ansible
$ ansible-playbook -i inventory playbooks/deploy.yml
```

If you would like an easier way to do this (and are okay with the `env_file` location being set to `<PROJECT_ROOT>/.env` and the `secrets_mode` set to `copy`), you can simply run:

``` shell
$ cd <PROJECT_ROOT>
$ ./bin/deploy
```

# Use the CLI <a name="cli"></a>

You can administer any running signalboost instance with:

``` shell
$ boost <command> <options>
```

Where `<command>` is one of the following:

``` shell
  help
    - shows this dialogue

  create-channel -p <chan_phone_number> -n <chan_name> -s <senders> -u <api_url>
    - creates a channel with provied phone number, name, and senders on signalboost instance at (optional) url

  create-number -a <area_code> -n <numbers_desired> -u <api_url>
    - purchases n new twilio numbers and registers them w/ signal via registrar at (optional) url

  list-channels -u <api_url>
    - lists all channels active on the signalboost instance at the given (optional) url

  list-numbers -u <api_url>
    - lists all numbers purchased from twilio on the signalboost instance at (optional) url

  release-numbers <path>
    - releases all phone numbers with twilio ids listed at given path
```

For more detailed instructions on any of the commands, run:

``` shell
$ boost <command> -h
```

# Contributing <a name="contributing"></a>

## Getting Started

### Secrets

Upon cloning the repo, do either of the following to provide missing env vars needed to run signalboost:

#### Secrets for General Public

You will need to provide your own values for credentials listed in `.env`. A sample of the values needed is listed in `.env.example`. You should replace all values in `%TEMPLATE_STRINGS` with your own values.

We realize that some of these secrets require paid accounts to work. And that contributing to this project shouldn't require paid accounts! We're trying to come up with a workaround... In the meantime: suggestions welcome! :)

#### Secrets for Maintainers

We use [blackbox](https://github.com/StackExchange/blackbox) to keep secrets under encrypted version control.

Use it to decrypt secrets and source them with:

```
$ git clone git@0xacab.org:team-friendo/signalboost
$ cd signalboost
$ ./bin/blackbox/decrypt_all_files
$ set +a && source .env && set -a
```
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

Get a psql shell:

``` shell
$ yarn db:psql
```
