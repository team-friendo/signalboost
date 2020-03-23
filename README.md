# Signalboost

Hi! This is mainly a developer-facing document. If you'd prefer less jargon, check out https://signalboost.info

## Table Of Contents:

* [Overview](#overview)
* [Application Design](#design)
* [Developer Guide](#developer-guide)
* [Using the CLI](#cli)
* [Sysadmin Guide](#sysadmin-guide)
  * [Deploy Instructions for General Public](#deploy-public)
  * [Deploy Instructions for Team Friendo](#deploy-team-friendo)

# Overview <a name="overview"></a>

**Signalboost** is a rapid response tool made by and for activists. It enables users to send encrypted text alerts over the [Signal messaging service](https://www.signal.org/) to mass subscriber lists without revealing the sender's phone number to recipients or recipients' phone numbers to each other -- for free. You could use it to send emergency alerts, mobilization updates, urgent requests for aid, or other inventive usages we never could have thought of! :) [[1](#txtmob_joke)]

**The stack** consists of node services calling out to the [signald](https://git.callpipe.com/finn/signald) Java app over unix sockets. See [Application Design](#design) for a detailed overview.

**Issue tracking and bug reports** live in our [gitlab repo on 0xacab.org](https://0xacab.org/team-friendo/signalboost) You can track **ongoing work** on the [project's kanban board](https://0xacab.org/team-friendo/signalboost/boards).

**Want to use signalboost for social justice work?**  Send us a signal message at `+1 (938) 444-8536` or email us at `team-friendo [AT] riseup [DOT] net` ([pgp key here](https://pgp.mit.edu/pks/lookup?op=get&search=0xE726A156229F56F1)) to request a signalboost channel for your group. We're also happy to help you learn how to install and maintain your own instance of a signalboost sever so you can run your own channel and not trust team-friendo with storing your subscriber list(s). :)

**NOTE: this project is not officially affiliated with the Signal App or Foundation.** We are just some humble rad techies trying to help our friends. We are grateful to Moxie, Trevor, and the Signal Foundation for maintaining a generous free/open ecosystem that makes projects like this possible. <@3
__________________

<a name="txtmob_joke"></a>
[1] *If you are a child of the (anarchist) 90's, you might usefully think of signalboost as "Like TXTMOB, but on Signal." If you cut your teeth on Occupy Wall Street, try "Like Celly, but on Signal." If you were born digital, try "Like Signal, but with text blasts."*

# Application Design <a name="design"></a>

## Data Flow

Data flows through the application in (roughly) the following manner:

* an application server controls several signal numbers, each of which acts as a "channel"
* admins and subscribers can interact with the channel by sending it commands in the form of signal messages. for example: people may subscribe and unsubscribe from a channel by sending a signal message to it that says "JOIN" or "LEAVE" (respectively). admins can add other admins by sending a message that says "ADD +1-555-555-5555", etc.
* when a admin sends a non-command message to a channel, the message is broadcast to all subscriber on that channel
* unlike with signal groups:
  * the message appears to the subscribers as coming from the phone number associated with the channel (not the admin).
  * subscribers may not see each others' phone numbers
  * subscribers may not respond to messages
* unlike with text blast services:
  * messages are free to send! (thanks m0xie!)
  * messages are encrypted between admins and the application and between the application and subscribers (NOTE: they are decrypted and reencrypted momentarily by the application but are not stored permanetly on disk)
  * admins may send attachments to subscribers
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
  * creates channels and adds/removes phone numbers, admins, and subscribers to/from them
3. a `dispatcher` service that reads incoming messages on every channel via unix socket connection to `signald`, then processes each message with both:
   * the `executor` subservice parses message for a command (e.g, `ADD` a admin to a channels). if it finds one,
 it executes the command and returns response message.
   * the `messenger` subservice handles the output from the executor. if it sees a command response it sends it to the command issuer. else it broadcasts incoming messages to channel subscribers if access control rules so permit.


# Developer Guide <a name="#developer-guide"></a>

We're so happy you want to help write code for Signalboost!

Please get started by reading our `CONTRIBUTING.md` file, located here:

https://0xacab.org/team-friendo/signalboost/blob/master/CONTRIBUTING.md

Then you'll probably want to know about...

## System Requirements

First you'll need to clone the repo:

``` shell
git clone git@0xacab.org:team-friendo/signalboost
cd signalboost
```

To develop signalboost, you should make sure your local computer has the following programs installed:

* make (you probably have this. check with `which make`. if you get output: you have it!)
* docker CE
* docker-compose
* jq

If you would like to be able to run individual unit tests on your computer, you will also  want:

* node
* postgresql

Installing those on a debian-flavored laptop would involve running the following commands:

``` shell
sudo apt-get install \
     apt-transport-https \
     ca-certificates \
     curl \
     gnupg2 \
     software-properties-common
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -
# check fingerprint matches 9DC8 5822 9FC7 DD38 854A  E2D8 8D81 803C 0EBF CD88, then:
sudo apt-key fingerprint 0EBFCD88
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]') \
   $(lsb_release -cs) \
   stable"
sudo apt-get update
sudo apt-get install docker-ce jq nodejs postgresql
pip install docker-compose
```

On a Mac (tested on 10.14.5 Mojave), that would look like:

``` shell
brew update
brew install docker docker-compose jq node postgresql
brew cask install docker
```

(Note: The `cask` version of docker allows you to run docker from Applications folder and get a nice systray icon. Some devs report needing to do that to get dev env working! :))

## Secrets <a name="secrets"></a>

Upon cloning the repo, do either of the following to provide missing env vars needed to run signalboost:

### Secrets for General Public

You will need to provide your own values for credentials listed in `.env.dev`. A sample of the values needed is listed in `.env.dev.example`. You should replace all values in `%TEMPLATE_STRINGS%` with your own values.

We realize that some of these secrets require paid accounts to work. And that contributing to this project shouldn't require paid accounts! We're trying to come up with a workaround... For example: https://0xacab.org/team-friendo/signalboost/issues/118

In the meantime: suggestions welcome! :)

### Secrets for Team Friendo Members <a name="team-friendo-secrets"></a>

We use [blackbox](https://github.com/StackExchange/blackbox) to keep secrets under encrypted version control.

To be able to use it, you first need to whitelist your gpg key:

* [make a working pgp key](http://irtfweb.ifa.hawaii.edu/~lockhart/gpg/) if you don't have one already
* obtain your public key fingerprint (with e.g., `gpg -K`)
* send your pgp public key fingerprint to a signalboost maintainer and ask them to add you to the blackbox whitelist of trusted pgp keys

Now that you are whitelisted, you can use blackbox to decrypt secrets and source them with:

```
cd path/to/signlaboost/
./bin/blackbox/decrypt_all_files
```

Or... if you prefer something easier to remember than `./bin/blackbox/blah-blah-blah`, just run:

``` shell
make _.unlock
```

**GOTCHA WARNING:** if you are running an older version of debian or ubuntu (which defaults to gpg v1 instead of gpg v2), you will get inscrutable errors when trying to invoke blackbox. This can be fixed by installing `gpg2` and then invoking blackbox with `GPG=gpg2 ./bin/blackbox/decrypt_all_files`

## Makefile

We have a lot of scripts to help run the app that are all defined in the repo's `Makefile`. You can list them all with:

``` shell
make help
```

If you type `make` and then hit `TAB`, you will get autocomplete suggestions for whatever you have typed so far.

Let's use some make commands to set up your dev env! :)

## Setup

This will build signalboost's docker containers, install its node dependencies, create its database, and run migrations:

``` shell
make _.setup
```

## Run Tests

``` shell
make test.all
```

If you want, you can run unit and e2e tests separately:

``` shell
make test.unit
```

``` shell
make test.e2e
```

## Run App

Run the app in dev mode with:

``` shell
make dev.up
```

## Stop App

To shut the app down gracefully (can take a while for all containers to spin down):

``` shell
make dev.down
```

To force all containers to shutdown immediately:

``` shell
make dev.abort
```


## Seed Data

You will need the `boost` cli tool installed to create seed numbers and channels.

See the [Using the Cli](#cli) section for instructions on installing and using it!

Note that to use the `boost` cli tool against your local dev server, you will always have to pass `-e .env.dev` as an argument to all `boost` calls in order to tell boost to talk to your local server instead of prod. 

If you find it annoying to type this over and over again, consider adding `export SIGNALBOOST_ENV_FILE=.env.dev` to your `~/.bashrc` (or equivalent file in your favorite shell program). This will set `.env.dev` as your default `.env` file, which you can still override by passing an explicit value to `-e` when invoking `boost`. (For example: `boost -e .env list-channels` would list all channels on prod.)

Once you've got the CLI installed, you can use the following to create 2 twillio numbers and verifiy them with signal on a local dev server running signalboost:

``` shell
make dev.up
boost -e .env.dev create-number -n 2 -u signalboost.ngrok.io -u signalboost.ngrok.io
```

Look for the first phone number returned by this call. Let's call it <channel_phone_number>. Let's call the phone number that you use in daily life <your_actual_phone_number>.

You can use the following to use a channel that uses <channel_phone_number> as its number and uses <your_actual_phone_number> as an admin of the channel:


```shell
boost create-channel \
    -e .env.dev \
    -p <channel_phone_number> \
    -n "my new channel" \
    -a <your_actual_phone_number> \
    -u signalboost.ngrok.io
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

To run all pending migrations (useful if another dev created migrations you haven't run yet):

```shell
make db.migrate.up
```

To drop the database (you will need to recreate seed data after this):

```shell
make db.drop
```

To get a psql shell (inside the postgres docker container for signalboost):

```shell
make db.psql
```

# Using the CLI <a name="cli"></a>

## Installing boost

Assuming you have already provided secrets in `.env` (as described in the [Secrets](#secrets) section of the [Developer Guide](#developer-guide)), you can proceed to...

Install* the CLI with:

```shell
make cli.install
```

(*NOTE: this puts the commands in `signalboost/cli/boost-commands` on your $PATH by symlinking `cli/boost` to `/usr/bin/boost`. If that feels intrusive to you, you are welcome to put `boost` on your $PATH in another way, or by just invoking it as `signalboost/cli/boost`)

You can uninstall it later with:

``` shell
make cli.uninstall
```

## Using boost

You can administer any running signalboost instance with:

``` shell
boost <command> <options> -e <path to .env file>
```

Where `<command>` is one of the following:

``` shell
  help
    - shows this dialogue

  add-admin -c <channel phone number> -a <admin phone number> -e <path to .env file>
    - adds an admin to a channel on the signalboost instance specified in .env file

  create-channel -p <chan_phone_number> -n <chan_name> -a <admins> -e <path to .env file>
    - creates a channel with provied phone number, name, and admins on signalboost instance specified in .env file

  create-number -a <area_code> -n <numbers_desired> -e <path to .env file>
    - purchases n new twilio numbers and registers them w/ signal via registrar on instance specified in .env file

  destroy -p <phone_number> -e <path to .env file>
    - permanently deletes the provided phone number on instance specified in .env file

  list-channels -e <path to .env file>
    - lists all channels active on the signalboost instance specified in .env file

  list-numbers -e <path to .env file>
    - lists all numbers purchased from twilio on the signalboost instance specified in .env file

  release-numbers <path>
    - releases all phone numbers with twilio ids listed at given path

  recycle -p <phone_numbers> -e <path to .env file>
    - recycles phone numbers for use creating new channels on signalboost instance specified in .env file
```

For more detailed instructions on any of the commands, run:

``` shell
boost <command> -h
```

## A note on .env files and boost

### Using multiple environments

If you would like to use `boost` to administer multiple different environments, you may provide create credentials in multiple different .env files, and then pass different values to the `-e` flag each time you invoke `boost`.

For example, assume you had two different servers, one in The Arctic Sea, and one in Antarctica. You could create an `.env` file for the Arctic Sea instance in the signalboost project root, and call it `.env.arctic` and similarly create `.env.antarctic` for the instance in Antarctica.

Then, to list all the channels in your Antarctic instance, you would use:

```shell
boost -e .env.antarctic list-channels
``` 

To list all the channels in your Arctic instance, you would use:

```shell
boost -e .env.arctic list-channels
``` 

### Setting default environments

You can set a default `.env` file for boost by declaring a value for `$SIGNALBOOST_ENV_FILE` somewhere in your `~/.bashrc` (or in another manner that ensures that `$SIGNALBOOST_ENV_FILE` is always in scope whenever you invoke boost.)

To continue the above example, if you found that you always are trying to use `boost` with your Arctic instance and almost never want to use it with your Antarctic instance, you might find it annoying to always have to accompany every command with `-e .env.arctcic`.  In that case, you could set `.env.arctic` as the default and list the channels on your Arctic server as follows:

```
export SIGNALBOOST_ENV_FILE=.env.arctic
boost list-channels
```

To avoid having to export `SIGNALBOOST_ENV_FILE` in every bash session, you could add the export statement to your `~/.bashrc` or `~/.bash_profile` file (or the equivalent for your favorite shell program).


# Sysadmin Guide <a name="sysadmin-guide"></a>

Want to help run an instance of signalboost on the official Team Friendo server or your own? Great! This section is for you!

It contains guides on system requirements you'll need to get started and two separate guides for people who want to run their own instances of signalboost ([Deploy Instructions for General Public](#deploy-public)) and Team Friendo members trying to learn how we deploy the mainline instance ([Deploy Instructions for Maintainers](#deploy-team-friendo))

The below is the shakiest part of this README! If you try anything below and it doesn't work, or you'd prefer it run a different way! Please open an issue/MR to help us fix it! We'd really appreciate the help!

## System Requirements

To be a sysadmin for a signalboost instance, you will need:

* ansible
* ansible-playbook
* various ansible roles from ansible-galaxy

If you are running debian-flavored linux, you can install all ansible dependencies with:

``` shell
sudo apt-add-repository --yes --update ppa:ansible/ansible
sudo apt install ansible
cd path/to/signalboost
make ansible.install
```

If you are on another system, [install ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) then run:

``` shell
ansible-galaxy install geerlingguy.docker
ansible-galaxy install geerlingguy.pip
ansible-galaxy install dev-sec.os-hardening
ansible-galaxy install dev-sec.ssh-hardening
```

## Deploy Instructions for General Public <a name="deploy-public"></a>

If you are a person who is not maintaining this repo, we want you to be able to install and maintain your own version of signalboost too! We just can't share our account credentials or server infrastructure with you -- sorry!

We've designed our deploy process so that you should be able to use it with your own credentials and infrastructure with some minor modifications. (If any of these steps don't work, please don't hesitate to post an issue so we can fix it!)

**(1) Load secrets:**

Create an .env file like the one provided in `.env.example`, but fill in all the values surrounded by `%` marks with actual values:

``` shell
# signal boost api service

SIGNALBOOST_HOST_URL=%DOMAIN NAME FOR PROD SERVER%
SIGNALBOOST_API_TOKEN=%HEX STRING%

# letsencrypt/nginx proxy configs

VIRTUAL_HOST=%DOMAIN NAME FOR PROD SERVER%
LETSENCRYPT_HOST=%DOMAIN NAME FOR PROD SERVER%
LETSENCRYPT_EMAIL=%EMAIL ADDRESS FOR TEAM SYSADMIN%

# twilio

TWILIO_ACCOUNT_SID=%HEX STRING%
TWILIO_AUTH_TOKEN=%HEX STRING%

```

To generate a decently random 32-byte hex string for your `SIGNALBOOST_API_TOKEN`, you could do the following:

``` shell
python
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

**(3) Provision and deploy signalboost:**

This step uses ansible to provision a server, install signalboost and all of its dependencies, then deploy and run signalboost.

It uses four playbooks (all of which can be found in the `ansible/playbooks` directory):

1. `provision.yml` (sets up users and system dependencies, performs basic server hardening)
1. `deploy.yml` (builds signalboost docker containers, installs and runs signalboost inside of them)
1. `harden.yml` (performs advanced server hardening -- takes a long time!)

You can run all playbooks with one command:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml
```

*Variation with different .env files:*

By default the secrets needed to run signalboost (including ip addresses and hostnames) are read from `<PROJECT_ROOT>/.env>` If you would like to provide an alternate set of secrets (for example, for a staging server), you can configure the location where ansible will look for the `.env` file by setting the `env_file` ansible variable (specified with an `-e env_file=<some_path>` flag). 

For example, to read secrets from `/path/to/staging.env`, you would issue the following command:

``` shell
cd ansible
ansible-playbook -e "env_file=/path/to/staging.env" playbooks/main.yml
```

**(4) Install the `boost` CLI tool:**

Signalboost ships with a cli tool for adding phone numbers, channels, and admins to the service.

Install it with:

``` shell
make cli.install
```
Learn more about how the CLI tools works in [Using the CLI](#cli).

**(6) Provision new twilio phone numbers:**

The below will provision 2 phone numbers in area code 510. (If you omit the `-n` and `-a` flag, boost will provision 1 number in area code 929.)

``` shell
boost new_numbers -n 2 -a 510
```

**(7) Provision new signalboost channels:**

Assuming the above returns by printing a success message for the new twilio phone number `+15105555555`, the below would create a new channel called `conquest of bread` on that phone number, administered by people with the phone numbers `+151066666666` and `+15107777777`.

``` shell
boost new_channel -p +15105555555 -n "conquest of bread" -a "+151066666666,+15107777777"
```

For more commands supported by the `boost` cli tool see the [Administering](#administering) section below.

**(8) Deploy updates to signalboost:**

On subsequent (re)deployments, you do not need to run the `provision`, `configure`, or `harden` playbooks. Instead you can just run:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/deploy.yml
```

## Deploy Instructions for Team Friendo <a name="deploy-team-friendo"></a>

If you are a member of `team-friendo`, here are instructions on how to provision, deploy, and maintain a running signalboost instance. :)

*NOTE: If you are administering an already-existent signalboost instance, you can omit steps 3 and 4.*

#### Initial Deployment

**(1) Load secrets:**

``` shell
make _.unlock
```

*NOTE: we use [blackbox](https://github.com/StackExchange/blackbox) for pgp-based credentials management. It is provided in `signalboost/bin/` as a convenience.


**(2) Obtain a server:**

*NOTE: If you are administering an already-existing signalboost instance, omit this step and skip straight to Step 5  ! :)*

``` shell
./bin/get-machine
```

**(3) Provision and deploy signalboost:**

*NOTE: If you are administering an already-existing signalboost instance, omit this step and skip straight to Step 5  ! :)*

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml
```

*Variation 1:* The above will deploy secrets by copying them from `<PROJECT_ROOT>/.env` on your local machine. If you would like to copy them from elsewhere, provide alternate path to the `deploy_file` ansible variable (specified with an `-e deploy_file=<...>` flag). For example, to copy environment variables from `/path/to/development.env`, run:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml -e env_file /path/to/development.env
```

*Variation 2:*: If you would like to deploy secrets by decrypting the copy of `.env.gpg` under version control (and thus more likely to be up-to-date), add the `-e "deploy_method=blackbox"` flag. For example:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml -e deploy
```

*Timing Note:* The last playbook (`harden.yml`) can take as long as 2 hours to run. After `deploy.yml` is finished. Thankfully, you can start using signalboost before it is complete! Just wait for the `deploy.yml` playbook (which will display the task header `Deploy Signalboost`) to complete, and proceed to the following steps...

**(4) Install the `boost` cli tool:**

We have a cli tool for performing common sysadmin tasks on running signalboost instances. You can install it with:

``` shell
make cli.install
```
To learn more about how the CLI tool works, see [Using the CLI](#cli)

**(5) List existing numbers/channels:**

You can check out what numbers and channels already exist with:

```shell
boost list-numbers
boost list-channels
```

**(6) Provision new twilio phone numbers:**

The below will provision 2 phone numbers in area code 510:

``` shell
boost create-number -n 2 -a 510
```

*NOTE: If you omit the `-n` and `-a` flag, boost will provision 1 number with a non-deterministic area code.*

**(7) Provision new signalboost channels:**

Assuming the above returns by printing a success message for the new twilio phone number `+15105555555`, the below would create a channel called `conquest of bread` on that phone number, and set the phone numbers `+151066666666` and `+15107777777`as senders on the channel.

``` shell
boost create-channel -p +15105555555 -n "conquest of bread" -a "+151066666666,+15107777777"
```

For more commands supported by the `boost` cli tool see the [Administering](#administering) section below.

**(8) Deploy updates to signalboost:**

On subsequent (re)deployments, you do not need to run the `provision`, `configure`, or `harden` playbooks. Instead you can just run:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/deploy.yml
```

If you would like an easier way to do this (and are okay with the `env_file` location being set to `<PROJECT_ROOT>/.env` and the `secrets_mode` set to `copy`), you can simply run:

``` shell
cd <PROJECT_ROOT>
make _.deploy
```
