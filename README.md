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

Perhaps you want a different $CHANNEL_PHONE_NUMBER. Change it now in `.env`. (Using `blackbox_edit .env`.)

Now let's set up `signal-cli`:

```
$ ./bin/install-signal-cli
$ useradd signal-cli
$ su signal-cli
$ ./bin/register
```

Get the verification code sent to your $CHANNEL_PHONE_NUMBER. Set the value of $VERIFICATION_CODE (in `.env`) to this value. And continue...

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

The issue above has okay instructions on how to downgrade your jdk version on debian. For more detailed instructions see [here](https://www.mkyong.com/linux/debian-change-default-java-version/j).

# Deployment

## First Time

Export these for convenience below

``` shell
export SB_HOSTNAME=<name of signal-booster prod server in your ssh config file>
export SB_USERNAME=<your username on the signal-booster box>
```

### Make GPG Deploy Key

Create the key:

``` shell
$ mkdir ~/tmp/sbkeys
$ cd ~/tmp/sbkeys
$ gpg --homedir . --gen-key

Your selection?
   (1) RSA and RSA (default)
What keysize do you want? (3092) DEFAULT
Key is valid for? (0) DEFAULT

# Real name: signal-booster
# Email address: signal-booster@signal-booster-<var>
```

Make it passwordless:

``` shell
$ gpg --homedir . --edit-key signal-booster
gpg> addkey
(enter passphrase)
  Please select what kind of key you want:
   (3) DSA (sign only)
   (4) RSA (sign only)
   (5) Elgamal (encrypt only)
   (6) RSA (encrypt only)
Your selection? 6
What keysize do you want? (3092)
Key is valid for? (0)
Command> key 2
(the new subkey has a "*" next to it)
Command> passwd
(enter the main key's passphrase)
(enter an empty passphrase for the subkey... confirm you want to do this)
Command> save
```

Export the public key and re-encrypt secrets to it:

``` shell
$ gpg --homedir . --export -a signal-booster > ./signal-booster-pubkey.asc
$ gpg import ./signal-booster-pubkey.asc
$ cd /path/to/signal-booster/repo
$ ./bin/blackbox_shred_all_files
$ ./bin/blackbox_update_all_files
```

Export the secret key and scp it to the production box:

``` shell

$ cd ~/tmp/sbkeys
$ gpg --homedir . --export-secret-keys -a signal-booster > ./signal-booster-privkey.asc
$ scp ./signal-booster-privkey.asc ${SB_HOSTNAME}:/home/${SB_USERNAME}/
```

Import the deploy key into the production box's keystore:

``` shell
$ ssh ${SB_HOSTNAME}
$ cd
$ gpg import signal-booster-privkey.asc
```

Delete unprotected private key material from your local machine:

``` shell
$ rm signal-booster-privkey.asc
$ exit
(back on your local machine...)
$ cd ~/tmp
$ rm -rf sbkeys
```

### Make SSH Deploy key

Make a deploy ssh key on your local machine:

``` shell
$ ssh-keygen -t ed25519 -o -a 100 -f ~/.ssh/id_signal_booster_deploy -C "sb@$SB_HOSTNAME"
```

Place it on prod:

``` shell
$ scp ~/.ssh/id_signal_booster_deploy ${SB_HOSTNAME}:/home/${SB_USERNAME}/
$ scp ~/.ssh/id_signal_booster_deploy.pub ${SB_HOSTNAME}:/home/${SB_USERNAME}/
```

Import it into your ssh agent:

``` shell
$ ssh $SB_HOSTNAME
$ cd
$ mv ./id_signal_booster_deploy* /home/aguestuser/signal-booster/.ssh/
$ eval `ssh-agent`
$ ssh-add ./id_signal_booster_deploy
```

Remove key material from your local machine:

``` shell
$ exit
(back on your local machine...)
$ rm ~/.ssh/id_signal_booster_deploy*
```

### Create PostGres DB and DB user

``` shell
$ psql -u postgres

postgres# CREATE USER signal_booster WITH
NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN
PASSWORD '<INSERT_PASSWORD_HERE>'

postgres# CREATE DATABASE signal_booster_production;

postgres# ALTER DATABASE signal_booster_production owner to signal_booster;
```

## First and Subsequent Times

Pull changes down to prod:

``` shell
$ ssh $SB_HOSTNAME
$ cd /home/signal-booster/signal-booster
$ ./bin/blackbox_shred_all_files
$ ssh-eval `ssh-agent`
$ ssh-add /home/signal-booster/.ssh/id_signal_booster_deploy
$ git pull git@0xacab.org:team-friendo/signal-boost
$ ./bin/blackbox_postdeploy
$ yarn install
$ sudo -u postgres yarn db:migrate:prod
$ sudo -u postgres yarn db:seed:prod
```

Restart app:

``` shell
$ tmux attach
<Ctrl-C>
$ sudo -u signal-booster yarn start
```
