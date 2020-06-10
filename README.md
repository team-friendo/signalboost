# Signalboost

Hi! This is mainly a developer-facing document. If you'd prefer less jargon, check out https://signalboost.info

## Table Of Contents:

* [Overview](#overview)
* [Application Design](#design)
* [System and Service Requirements](#services)
* [Developer Guide](#developer-guide)
* [Sysadmin Guide](#sysadmin-guide)
* [Using the Signalboost App, Makefile and Boost CLI](#app-details)

# Overview <a name="overview"></a>

**Signalboost** is a rapid response tool made by and for activists. It enables users to send encrypted text alerts over the [Signal messaging service](https://www.signal.org/) to mass subscriber lists without revealing the sender's phone number to recipients or recipients' phone numbers to each other -- for free. You could use it to send emergency alerts, mobilization updates, urgent requests for aid, or other inventive usages we never could have thought of! :) [[1](#txtmob_joke)]

**The stack** consists of node services calling out to the [signald](https://git.callpipe.com/finn/signald) Java app over unix sockets. See [Application Design](#design) for a detailed overview.

**Issue tracking and bug reports** live in our [gitlab repo on 0xacab.org](https://0xacab.org/team-friendo/signalboost) You can track **ongoing work** on the [project's kanban board](https://0xacab.org/team-friendo/signalboost/boards).

**Want to use Signalboost for social justice work?**  Send us a Signal message at `+1 (938) 444-8536` or email us at `team-friendo [AT] riseup [DOT] net` ([pgp key here](https://pgp.mit.edu/pks/lookup?op=get&search=0xE726A156229F56F1)) to request a Signalboost channel for your group. We're also happy to help you learn how to install and maintain your own instance of a Signalboost sever so you can run your own channel and not trust Team Friendo with storing your subscriber list(s). :)

**NOTE: this project is not officially affiliated with the Signal App or Foundation.** We are just some humble rad techies trying to help our friends. We are grateful to Moxie, Trevor, and the Signal Foundation for maintaining a generous free/open ecosystem that makes projects like this possible. <@3
__________________

<a name="txtmob_joke"></a>
[1] *If you are a child of the (anarchist) 90's, you might usefully think of Signalboost as "Like TXTMOB, but on Signal." If you cut your teeth on Occupy Wall Street, try "Like Celly, but on Signal." If you were born digital, try "Like Signal, but with text blasts."*

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
* notably: the list of subscribers is currently stored on disk on the Signalboost server. if this makes you nervous, you can:
  * host your own instance of Signalboost (see docs below)
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
   
   
# System and Service Requirements <a name="services"></a>

Signalboost relies on a few external services and tools. These dependencies and setup vary slightly between a production/deploy setup and local development. If you are just getting started with Signalboost we recommend you walk through this section to get those ready. 

**If you are a member of Team Friendo we provide accesss to the exsiting servers and services listed here. Checkout the [Secrets for Team Friendo Members](#Team-Friendo-secrets) section. Otherwise this section will walk you through the setup of services, both for production servers or/and your local development system.** 


## Getting started

To host your own production instance of Signalboost you need:

* A server running Debian or Ubuntu GNU/Linux distributions with a static IP address as your production server.
* A local development setup able to run Ansible to deploy the code to your Signalboost production server.
* A domain with an A record pointing to the production server’s static IP address.
* A Twillio account (https://www.twilio.com/) that provides the phone numbers that Signalboost will use. 
* An email address to provide to Let's Encrypt (https://letsencrypt.org/) for easy, seamless ssl support.
* A Signalboost API Token created by you to authenticate on your Signalboost API.

To do local development for Signalboost you need: 

* A local computer able to run node and docker, git and the development tools of your choice. 
* A Twillio account (https://www.twilio.com/) that provides the phone numbers that Signalboost will use. 
* A Signalboost API Token created by you to authenticate on your Signalboost API.

We'll address the setup of production and development systems in the Developer and Sysadmin guides later, but for now here's some details on how to get the services and authentication details you need for the configuration you want to do.


## Setup third party services and other details

Identify above what credentials and services are needed for your taget setup and use these details to get what you need:

**Domain**

If you want to run a production version of Signalboost you will need a domain. If you already have one you can use great, if not register one for your new instance and create an A record for the IP address of your production server. For domain name registration we think that [Njal.la](https://njal.la) is hands down the best option. 

**Twillio Account**

To get Twilio credentials, sign up for a Twilio account [here](https://www.twilio.com/try-twilio), then visit the [console page](https://www.twilio.com/console) and look for the `ACCOUNT SID` and `AUTH TOKEN` fields on the righthand side of the page. You will need these for configuration later.  A free account only provides one phone number, but might be enough to get you started. You will need a number for ever channel you want to host. Besides any hosting costs Twillio numbers, at $1 a number per month, are the main additional cost of hosting a Signalboost server. 

**Let's Encrypt Account** 

[Let's Encrypt] (https://letsencrypt.org/) does not require you to create an account, but it will require you to provide an email address in our configuration files so decided what address you want to use here. 

**Signalboost API Token**

You will need a hex string for the Signalboost API Token for both a production deploy and local development. To generate a decently random 32-byte hex string you could do the following on the command line of any *nix system running python3:


```shell 
python
>>> import secrets
>>> secrets.token_hex(32)
```

> Hint: Errors doing this usually relate to systems with multiple python versions installed so sometimes specifiying `python3` solves for that. 


# Developer Guide <a name="#developer-guide"></a>

We're so happy you want to help write code for Signalboost! If you have not already reviewed the [System and Service Requirements](#services) section above please start there.  

Please also read our `CONTRIBUTING.md` file, located here:

https://0xacab.org/team-friendo/signalboost/blob/master/CONTRIBUTING.md


## Setting up your local development environment 

### (1) Get Signalboost

First you'll need to clone the repo:

``` shell
git clone git@0xacab.org:team-friendo/signalboost
cd signalboost
```


### (2) Install dependencies

To develop Signalboost you should make sure your local computer has the following programs installed:

* make (you probably have this. check with `which make`. if you get output: you have it!)
* docker CE
* docker-compose
* jq

If you would like to be able to run individual unit tests on your computer, you will also want:

* node
* postgresql

Installing those on a debian-flavored computer would involve running the following commands:

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

(Note: The `cask` version of docker allows you to run docker from Applications folder, avoid some permissions complexity and get a nice systray icon. Some devs report needing to do that to get dev env working! :))


### (3) Complete development configuration 

Configuration for development basically involves creating your initial `.env.dev` file and loading it with the details you created in the [System and Service Requirements](#services) section above.

**Team Friendo: If you are a member of Team Friendo we povide these service configuration details for you and an easy way to unlock them, jump to the [Secrets for Team Friendo Members](#Team-Friendo-secrets) section.**

#### Secrets for General Public

Copy the `.env.dev.example` file to just `.env.dev` in the root of your Signalboost repo.

``` shell
cd path/to/signlaboost/
cp .env.dev.example .env.dev
```

You will need to provide values for the credentials listed in `.env.dev`. You should replace the values in `%TEMPLATE_STRINGS%` with your own values.

Leave the value for `SIGNALBOOST_ENV=development` intact. It is important for making sure configuration scripts run properly. :) 

Provide the Signalboost API Token you generated:

``` shell
# Signalboost API authentication // Required for authentication in all modes 
# See the README for details on how to generate a suitable HEX string

SIGNALBOOST_API_TOKEN=%HEX STRING%
```

Add your Twillio credentials:

``` shell
# Twilio // Required in all modes to create channel numbers. Signup at https://www.twilio.com/  
# Free accounts work but are limited to one phone number which will limit your ability to create channels

TWILIO_ACCOUNT_SID=%HEX STRING%
TWILIO_AUTH_TOKEN=%HEX STRING%
```

#### Team Friendo: Configuration Secrets for Team Friendo Members <a name="Team-Friendo-secrets"></a>

We use [blackbox](https://github.com/StackExchange/blackbox) to keep secrets under encrypted version control.

To be able to use it, you first need to whitelist your gpg key:

* [make a working pgp key](http://irtfweb.ifa.hawaii.edu/~lockhart/gpg/) if you don't have one already
* obtain your public key fingerprint (with e.g., `gpg -K`)
* send your pgp public key fingerprint to a Signalboost maintainer and ask them to add you to the blackbox whitelist of trusted pgp keys

Now that you are whitelisted, you can use blackbox to decrypt secrets and source them with:

``` shell
make _.unlock
```
which runs `./bin/blackbox/decrypt_all_files` to upack our .env.dev and other configuration files to get you what you need. 

> GOTCHA WARNING: if you are running an older version of debian or ubuntu (which defaults to gpg v1 instead of gpg v2), you will get inscrutable errors when trying to invoke blackbox. This can be fixed by installing `gpg2` and then invoking blackbox with `GPG=gpg2 ./bin/blackbox/decrypt_all_files`


### (4) Run Setup 

This will build Signalboost's docker containers, install its node dependencies, create its database, and run migrations:

``` shell
make _.setup
```
It will take a moment the first time it runs as it downloads the docker images and other resources. 

Signalboost has a extensive and handy `make` file, learn more about it [here](#makefile). But don't let that distract you, you are almost there!


### (5) Stop and start the Signalboost App in dev mode 

Now you should be able to start up Signalboost. We provide a few really simple `make` commands for these tasks. 

Run the app in dev mode with:

``` shell
make dev.up
```

Assuming everything worked as expect so far you should see a log output as the docker containers start up and towards the end you should see something like `[Signalboost  xxxxxx] > Signalboost running!`.

To shut the app down gracefully (can take a while for all containers to spin down):

``` shell
make dev.down
```

To force all containers to shutdown immediately:

``` shell
make dev.abort
```

### (6) Install the Boost CLI <a name="cli"></a>

You need the Boost CLI to create and administer channels.

Install the CLI with:

```shell
make cli.install
```

This puts the commands in `signalboost/cli/boost-commands` on your $PATH by symlinking `cli/boost` to `/usr/bin/boost`. If that feels intrusive to you, you are welcome to put `boost` on your $PATH in another way, or by just invoking it as `signalboost/cli/boost`)

> NOTE: because this is a symlink if you move or rename your signalboost directory it will break. It will also not work in any secondary directory you create because it will run in the initial one so be use the uninstall command to clean up and re-install.

You can uninstall it later with:

``` shell
make cli.uninstall
```

To use the `boost` cli tool for development you will always have to pass `-e .env.dev` as an argument to all `boost` calls in order to tell `boost` to talk to your local system instead of production. 

If you find it annoying to type this over and over again, consider adding `export SIGNALBOOST_ENV_FILE=.env.dev` to your `~/.bashrc` (or equivalent file in your favorite shell program). This will set `.env.dev` as your default `.env` file, which you can still override by passing an explicit value to `-e` when invoking `boost`. (For example: `boost list-channels -e .env ` would list all channels on prod.)

Learn more about how the CLI tools works in [Using the Boost CLI](#boost-cli).


### (7) Create Seed Data

Once you've got the CLI installed, you can use the following to create some Twillio numbers for use in your channels and emulators etc. NOTE: it is important that you use the `-e` flag to make sure that `boost` uses the values you defined in `.env.dev` specific to your local development environment:

``` shell
make dev.up
boost create-number -e .env.dev -n 2 
```

Look for the first phone number returned by this call. Let's call it `<channel_phone_number>`. Let's call the phone number that you use in daily life `<your_actual_phone_number>`.

You can use the following to create a channel that uses `<channel_phone_number>` as its number and uses `<your_actual_phone_number>` as an Admin of the channel:


```shell
boost create-channel \
    -e .env.dev \
    -p <channel_phone_number> \
    -n "my new channel" \
    -a <your_actual_phone_number> \
```

**Congrats! You should now have your first channel running on your local development instance of Signalboost.**

Be sure to checkout our [contributor guide](https://0xacab.org/team-friendo/signalboost/blob/master/CONTRIBUTING.md) for more details on successfully contributing.  Our [`make` script](#make-file) includes handy commands for running tests and migrations.  


# Sysadmin Guide <a name="sysadmin-guide"></a>

Want to deploy an instance of Signalboost on the official Team Friendo server or your own production server? Great! This section is for you!

**Team Friendo:  If you are a member of Team Friendo look for details here about how to use [blackbox](https://github.com/StackExchange/blackbox) to access our shared configuration files.**

If you have not already reviewed the [System and Service Requirements](#services) section above please start there to ensure you have the configuration details you'll need. 


## Deploy Instructions <a name="deploy-guide"></a>

If you are a person who is not maintaining this repo, we want you to be able to install and maintain your own version of Signalboost too! We just can't share our account credentials or server infrastructure with you -- sorry!

We've designed our deploy process so that you should be able to use it with your own credentials and infrastructure with some minor modifications. (If any of these steps don't work, please don't hesitate to post an issue so we can fix it!)

### (1) Setup your production server

Signup for a server running either the Debian or Ubuntu GNU/Linux distributions, note the static IP and configure a domain to the new server.

If you need help finding a server, we'd recommend shopping for a VPS from one the following lovely social-justice oriented groups:

- [Njalla](https://njal.la)
- [Greenhost](https://greenhost.nl)
- [1984](https://1984.is)
- [Mayfirst](https://mayfirst.org)

*NOTE: We do not recommend DigitalOcean, as a matter of fact it absolutely will not work at all as Signal blocks traffic from this service.*

With your new server login as root and:

- ensure (for now) that root login works and add your local users SSH key to root if it is not already added.
- run `apt update` to update apt
- install python3 with `apt install python3`

> During the Ansible configuration steps additional users will be created and the root login locked down, but we need it for now. Do not lock down ssh for the root login at this point, if you do ansible's setup later will fail.

### (2) Get Signalboost on your local system

On the system you plan to use to deploy Signalboost from you'll first need to clone the repo:

`git clone git@0xacab.org:team-friendo/signalboost.git`


### (3) Install dependencies on your local deploy system

#### Install Ansible

To deploy a Signalboost instance, you will need to have installed:

* ansible
* ansible-playbook
* various ansible roles from ansible-galaxy

If you are running debian-flavored linux, you can do this with:

``` shell
sudo apt-add-repository --yes --update ppa:ansible/ansible
sudo apt install ansible
cd path/to/signalboost
make ansible.install
```

and our `make` file will then install the Ansible dependencies.

If you are on another system, first [install ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html). Then run these commands to install the Ansible dependencies manually:

``` shell
ansible-galaxy install geerlingguy.docker
ansible-galaxy install geerlingguy.pip
ansible-galaxy install dev-sec.os-hardening
ansible-galaxy install dev-sec.ssh-hardening
```

### (4) Complete production configuration 

**Team Friendo we use [blackbox](https://github.com/StackExchange/blackbox) for pgp-based credentials management.** If you have provided your PGP key to another Friendo and it has been added you can simply use blackbox to decrypt the mostly pre-configured files outlined below. Do this with:

``` shell
make _.unlock
```

**If you are not a member of Team Friendo** you will need to customize two files with the service and system details. Copy those files that with:

``` shell
cd path/to/signalboost
cp .env.example .env
cp ansible/inventory.example ansible/inventory
```
And complete these steps to get the files configured. 

#### Configure .env

You will need to provide your own values for credentials listed in `.env`. You should replace the values in `%TEMPLATE_STRINGS` with your own values from the System and Service Requirements section above as well as the static IP address of your production server. 

For production deploy only these need to be set... 

Provide your server's domain name for the API:
```
# Signalboost API service // URL is used by the Boost cli as the default url for the API when this file is called with the -e flag.

SIGNALBOOST_HOST_URL=%FULL DOMAIN NAME FOR PROD SERVER%
```

Provide the Signalboost API Token you generated for:

```
# Signalboost API authentication // Required for authentication in all modes 
# See the README for details on how to generate a suitable HEX string

SIGNALBOOST_API_TOKEN=%HEX STRING%
```

Add your Twillio credentials:
```
# Twilio // Required in all modes to create channel numbers. Signup at https://www.twilio.com/  
# Free accounts work but are limited to one phone number which will limit your ability to create channels

TWILIO_ACCOUNT_SID=%HEX STRING%
TWILIO_AUTH_TOKEN=%HEX STRING%
```

Provide your server's API domain name for both the `VIRTUAL_HOST` and `LETSENCRYPT_HOST` options. Then provide a working email address for Let's Encrypt to use:
```

# letsencrypt/nginx proxy configs // Used in Production mode only. Works magically if you provide a valid email, no registration needed
# Automatically creates and refreshes the SSL cert for the Nginx proxy server in production. https://letsencrypt.org/ 

VIRTUAL_HOST=%FULL DOMAIN NAME FOR PROD SERVER%
LETSENCRYPT_HOST=%FULL DOMAIN NAME FOR PROD SERVER%
LETSENCRYPT_EMAIL=%EMAIL ADDRESS FOR TEAM SYSADMIN%
```

For now we'll comment out this optional item because we need the Boost CLI to creat this channel on twillio:
```
# Support channel number // Optional Phone number used by Signalboost for the special "support channel" 
# Use Boost cli to create these, you only need the one specific to the mode you are running in
# Format must be e164 (https://www.twilio.com/docs/glossary/what-e164), with the + and with no special characters

#SUPPORT_CHANNEL_NUMBER=%+15554445555%
```

#### Configure ansible/inventory

In the  ansible `inventory` file we created we will define the intial credentials ansible will create and use to setup Signalboost.  You will need the static `{{ IP ADDRESS OF YOUR REMOTE HOST }}`, `{{ A USERNAME TO BE CREATED BY ANSIBLE, NOT ROOT }}` and the local `{{ PATH TO YOUR SSH PRIVATE KEY }}`.

You must add at least one `admin`, that matches the ansible_user you defined above. Add additional admins if you need additional users on your server. The `{{ SSH PUBKEY OF AN ADMIN }}` in this case expects a full pub key contained in quotes: 

```
signalboost:
  hosts:
    {{ IP ADDRESS OF YOUR REMOTE HOST }}
  vars:
    ansible_user: {{ A USERNAME TO BE CREATED BY ANSIBLE, NOT ROOT }}
    ansible_ssh_private_key_file: {{ PATH TO YOUR SSH PRIVATE KEY }}
    ansible_ssh_common_args: '-o IdentitiesOnly=yes'
    admins:
      - name: {{ USERNAME OF YOUR ANSIBLE_USER ABOVE }}
        ssh_key: {{ SSH PUBKEY OF AN ADMIN }}
      - name: {{ USERNAME OF ANOTHER ADMIN }}
        ssh_key: {{ SSH PUBKEY OF ANOTHER ADMIN }}
```

You can generate an appropriate SSH key with:

```shell
ssh-keygen -t ed25519 -o -a 100 -f ~/.ssh/id_signalboost
```

That will produce a public key in ~/.ssh/id_signalboost.pub and a private key in ~/.ssh/id_signalboost. 

### (5) Provision and deploy Signalboost 

This step uses ansible to provision a server, install Signalboost and all of its dependencies, then deploy and run Signalboost.

It uses four playbooks (all of which can be found in the `ansible/playbooks` directory):

1. `provision.yml` (sets up users and system dependencies, performs basic server hardening)
1. `deploy.yml` (builds Signalboost docker containers, installs and runs Signalboost inside of them)
1. `harden.yml` (performs advanced server hardening -- takes a long time!)

You can run all playbooks with one command:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml
```

But initially we recommend running each one, one at a time to monitor the outcome:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/provision.yml
ansible-playbook -i inventory playbooks/deploy.yml
ansible-playbook -i inventory playbooks/harden.yml
```

It is not unsual to have to run `provision.yml` multiple times with small errors that are resolves by a re-run. 

> GOTCHA WARNING: `harden.yml` has been a source of ongoing problems with deployment, you may find that running it will not work because of package issues. You can absolutely run Signalboost without using it but it's going to make your server more secure. 

Because the last playbook (`harden.yml`) can take as long as 2 hours to run! But after `deploy.yml` is finished thankfully, you can start using Signalboost before it is complete! Just wait for the `deploy.yml` playbook (which will display the task header `Deploy Signalboost`) to complete and you can proceed to the next steps.

*Variation to accomodate multiple remote hosts and .env files:*

By default the deploy tooling described above assumes you are deploying to one single server, with a `host` listed as `signalboost` in `ansible/inventory` and credentials listed in `.env`. But perhaps you would like to deploy Signalboost to multiple servers, each with different credentials!

To do this, we can leverage ansible's "extra-vars" feature, defining a `sb_host` and `env_file` variable that we pass to `ansible-playbook` at deploy-time to override the defaults we have encoded in `inventory.signalboost` and `.env`.

For example, to deploy to a host listed as `antarctica` in `ansible/hosts` and credentials defined in`.env.antarctica`, you would issue the following command:

``` shell
cd ansible
ansible-playbook -i inventory -e "sb_host=antarctica env_file=/path/to/.env.antarctica" playbooks/main.yml
```

Once all the playbooks complete you should have a running Signalboost server available at the API domain you defined in your `.env` file and can proceed to use the `boost` cli to generate numbers and create new channels with them. 

 
### (6) Install the Boost CLI tool

Signalboost ships with a cli tool for adding phone numbers, channels, and admins to the service.

Install it with:

``` shell
make cli.install
```

Learn more about how the CLI tools works in [Using the Boost CLI](#cli)


### (7) Channel setup with the Boost CLI

By default your local instance of the `boost` CLI will read the local `.env` file and use the remote production server details you defined there. So these commands when run locally will contact the API on your production server unless overridden by the `-e <path to .env file>`. (See [Using the Boost CLI](#cli) for more info.)


#### Provision two Twillio numbers

The below will provision 2 phone numbers in area code 510:

``` shell
boost create-number -e .env -n 2 -a 510
```

> NOTE: If you omit the `-n` and `-a` flag, boost will provision 1 number with a non-deterministic area code.


#### Provision a new Signalboost channel

Assuming the above returns by printing a success message for the new twilio phone number `+15105555555`, the below would create a channel called `conquest of bread` on that phone number, administered by people with the phone numbers `+151066666666` and `+15107777777`.

``` shell
boost create-channel -e .env -p +15105555555 -n "conquest of bread" -a "+151066666666,+15107777777"
```

#### List existing numbers and channels

You can check out what numbers and channels already exist with:

```shell
boost list-numbers -e .env
boost list-channels -e .env
```

### (9) Deploy later updates to Signalboost

On subsequent (re)deployments, you do not need to run the `provision`, `configure`, or `harden` playbooks. Instead you can just run:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/deploy.yml
```

*Variation 1:* The above will deploy secrets by copying them from `<PROJECT_ROOT>/.env` on your local machine. If you would like to copy them from elsewhere, provide alternate path to the `deploy_file` ansible variable (specified with an `-e deploy_file=<...>` flag). For example, to copy environment variables from `/path/to/development.env`, run:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml -e env_file /path/to/development.env
```

*Variation 2:*: If you are a member of Team Friendo and you would like to deploy secrets by decrypting the copy of `.env.gpg` under version control (and thus more likely to be up-to-date), add the `-e "deploy_method=blackbox"` flag. For example:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml -e deploy
```


# Using the Signalboost App, Makefile and Boost CLI <a name="app-details"></a>

With the app running...

Any human should be able to:

* Join the channel by sending a signal message with contents "JOIN" to `$CHANNEL_PHONE_NUMBER`
* Leave the channel by sending a signal message with contents "LEAVE" to `$CHANNEL_PHONE_NUMBER`

Any admin should be able to:

* Broadcast a message to all channel subscribers by sending it to `$CHANNEL_PHONE_NUMBER`
* Receive all messages broadcast to the channel


### Makefile <a name="make-file"></a>

We have a lot of scripts to help run the app that are all defined in the repo's `Makefile`. You can list them all with:

``` shell
make help
```

If you type `make` and then hit `TAB`, you will get autocomplete suggestions for whatever you have typed so far.

### Run Tests

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

To get a psql shell (inside the postgres docker container for Signalboost):

```shell
make db.psql
```

### Using the Boost CLI  <a name="boost-cli"></a>

The `boost` cli can be run from your development or deploy system against the API of your production server. By default it reads the local `.env` file and uses the SIGNALBOOST_HOST_URL value as its target API. This can cause confusion when you are developing in a codebase that is configured for deploy. It is a good idea to always be specific about the target `.env` file and use the `-e` flag to specify it in each command. 

You can also run `boost` directly on your production server where it will use the local `.env` file it finds there. Our development setup steps encourage you to install jq on your localhost, which is needed for `boost` command output. Ansible does not install this on production servers and it will need to be installed manually if you wish to run `boost` directly on your production server.

Assuming you have already provided secrets in `.env` or `.env.dev` (as described in the [Secrets](#secrets) section of the [Developer Guide](#developer-guide)) and have already installed the CLI with:

```shell
make cli.install
```

You can administer any running Signalboost instance with:

``` shell
boost <command> <options>
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

### Using multiple .env files to managed different servers

If you would like to use `boost` to administer multiple different servers, you may provide credentials in multiple different .env files, and then pass different values to the `-e` flag each time you invoke `boost` to access the API for each server.

For example, assume you had two different servers, one in The Arctic Sea, and one in Antarctica. You could create an `.env` file for the Arctic Sea instance in the signalboost project root, and call it `.env.arctic` and similarly create `.env.antarctic` for the instance in Antarctica.

Then, to list all the channels in your Antarctic instance, you would use:

```shell
boost list-channels -e .env.antarctic
```

To list all the channels in your Arctic instance, you would use:

```shell
boost list-channels -e .env.arctic 
```

### Setting a default .env file

You can set a default `.env` file for boost by declaring a value for `$SIGNALBOOST_ENV_FILE` somewhere in your `~/.bashrc` (or in another manner that ensures that `$SIGNALBOOST_ENV_FILE` is always in scope whenever you invoke boost.)

To continue the above example, if you found that you always are trying to use `boost` with your Arctic instance and almost never want to use it with your Antarctic instance, you might find it annoying to always have to accompany every command with `-e .env.arctic`.  In that case, you could set `.env.arctic` as the default and list the channels on your Arctic server as follows:

```
export SIGNALBOOST_ENV_FILE=.env.arctic
boost list-channels
```

To avoid having to export `SIGNALBOOST_ENV_FILE` in every bash session, you could add the export statement to your `~/.bashrc` or `~/.bash_profile` file (or the equivalent for your favorite shell program).
