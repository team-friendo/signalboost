# Signal Boost

This program provides provides free, subscribable, encrypted mass text blasts over the [signal messaging service](https://www.signal.org/). 

It is being made for and in consultation with frontline activists to help them quickly and safely alert friends to mobilize in times of emergency. 

The stack is a fun mix of nodejs apps, just-in-time docker containers, dbus interfaces, and (as needed) upstream modifications to the lovely [signal-cli](https://github.com/AsamK/signal-cli) java app.


# Design

Data flow through the applicatoin looks like this:

* there is an application that controls several signal numbers, each of which acts as a "channel"
* admins and other humans can interact with the channel by sending it commands in the form of signal messages. for example: humans may subscribe and unsubscribe from a channel by sending a signal message to it that says "JOIN" or "LEAVE" (respectively). admins can add other admins my sending a message that says "ADD +15555555555", etc.
* when an admin sends a non-command message to a channel, the message is broadcast to all humans subscribed to that channel
* unlike with signal groups: (1) the message appears to the subscribers as coming from the phone number associated with the channel (not the admin). (2) subscribers may not see each others' phone numbers, (3) subscribers may not respond to messages
* unlike with text blast services: (1) messages are encrypted between admins and the application and between the application and subscribers (they are decrypted and reencrypted momentarily by the application but are not stored permanetly on disk), (2) admins may send attachments

The application has the following components:

* a `channelRepository` service that keeps track of what channels exist, what admins may send to them, and what humans are subscribed to them
* a `message` service that controls a set of signal numbers and can send and receive signal messages as those numbers via the dbus interface exposed by `signal-cli` (running in daemon mode as a systemd service).
* a `dispatch` service that reads incoming messages and either forwards them to the `message` services, or to the `commmand` service based on the message content and a set of permissions defined by queries to the `channelRespository` (where permissions, etc. are encoded)

# Hacking

## Getting Started

### System Dependencies

#### JDK

*NOTE: for attachment relaying to work, your dev machine will need to be running an outdated version of OpenJDK at runtime. See `JDK Versioning` below for details. (TODO: containerize the app so devs don't have to worry about this!)*

#### Secrets

We use `blackbox` to keep secrets under encrypted version control. (See [this link](https://github.com/StackExchange/blackbox) for docs and configurations not covered below.)

Upon cloning the repo, use blackbox to decrypt secrets and export them into your environment:

```
$ git clone git@0xacab.org:team-friendo/signal-boost
$ cd signal-boost
$ ./bin/blackbox/decrypt_all_files
$ source .env
```

You might want to change a few of the secrets, most notably:

* You want a different $CHANNEL_PHONE_NUMBER. You can change it with `./bin/blackbox_edit .env`.
* You might want to change the admin in the db seeds. Change it with `./bin/blackbox_edit app /db/20190125203925-testing-channels.js`

#### Ngrok

We use `ngrok` to provide an external URL for twilio sms webhook endpoints in dev mode. To install on debian-like linux, run:

``` shell
$ wget wget https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.zip
$ unzip ngrok-stable-linux-amd64.zip
$ sudo mv ngrok /usr/local/bin/
$ source .env
$ ngrok authtoken $NGROK_AUTH_TOKEN
```

If you want to test that `ngrok` is working run:

``` shell
$ ngrok help
$ ngrok http 80
```

#### Signal-Cli

Now let's set up `signal-cli`:

```
$ ./bin/install-signal-cli
$ ./bin/configure-signal-cli
```

## JDK Versioning

Due to [this known issue](https://github.com/AsamK/signal-cli/issues/143#issuecomment-425360737), you must use JDK 1.8.0 in order for attachment sending to work.

The issue above has okay instructions on how to downgrade your jdk version on debian. For more detailed instructions see [here](https://www.mkyong.com/linux/debian-change-default-java-version/j).

### Run Tests

``` shell
$ yarn test
```

### Run App

(For first runs), create and seed the database with :

``` shell
$ yarn db:setup
```

Run the app in dev mode with:

``` shell
$ yarn dev
```

Register testing channel phone numbers with Signal:

``` shell
$ ./bin/pnums/register-all localhost:3000
```

We use `supervisord` to run all the processes involved in running the app.

To check on the status of the app's various processes, stop them, or shutdown `supervisord`, you can use the following commands (respectively):

``` shell
$ yarn status
$ yarn stop
$ yarn shutdown
```


### Use App

With the app running...

Any human should be able to:

* Join the channel by sending a signal message with contents "JOIN" to `$CHANNEL_PHONE_NUMBER`
* Leave the channel by sending a signal message with contents "LEAVE" to `$CHANNEL_PHONE_NUMBER`

Any admin should be able to:

* Broadcast a message to all channel subscribers by sending it to `$CHANNEL_PHONE_NUMBER`
* Receive all messages broadcast to the channel

# Deployment

NOTE: ALL OF THIS WILL VERY SHORTLY BE DEPRECATED AS SOON AS [TICKET #32](https://0xacab.org/team-friendo/signal-boost/issues/32) LANDS.

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
$ sudo -u signal-booster ./bin/blackbox_shred_all_files
$ sudo -u signal-booster ./bin/blackbox_update_all_files
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
$ sudo -u signal-booster gpg import signal-booster-privkey.asc
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
$ mkdir /home/signal-booster/.ssh
$ mv ./id_signal_booster_deploy* /home/signal-booster/.ssh/
$ sudo chown -R signal-booster:signal-booster /home/signal-booster/.ssh
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

### Initial Deploy

Pull changes down to prod:

``` shell
$ ssh $SB_HOSTNAME
$ ssh-eval `ssh-agent`
$ ssh-add /home/signal-booster/.ssh/id_signal_booster_deploy
$ cd /home/signal-booster
$ sudo -u signal-booster git clone git@0xacab.org:team-friendo/signal-boost
$ sudo -u signal-booster ./bin/blackbox_postdeploy
$ sudo -u signal-booster yarn install
$ sudo -u postgres yarn db:migrate:prod
$ sudo -u postgres yarn db:seed:prod
```

Restart app:

``` shell
$ tmux attach
<Ctrl-C>
$ sudo -u signal-booster yarn start
```

## Subsequent Deploys

Get shell and configure ssh for session:

``` shell
$ ssh $SB_HOSTNAME
$ ssh-eval `ssh-agent`
$ ssh-add /home/signal-booster/.ssh/id_signal_booster_deploy
$ export GIT_SSH_COMMAND="ssh -i /home/signal-booster/.ssh/id_signal_booster_deploy"
```

Pull changes:

``` shell
$ cd /home/signal-booster/signal-booster
$ sudo -u signal-booster ./bin/blackbox_shred_all_files
$ sudo -u signal-booster git pull
$ sudo -u signal-booster ./bin/blackbox_postdeploy
$ sudo -u signal-booster yarn install
$ sudo -u postgres yarn db:migrate:prod
$ sudo -u postgres yarn db:seed:prod
```

Restart app:

``` shell
$ tmux attach
<Ctrl-C>
$ sudo -u signal-booster yarn start
```
# Provision New Twilio/Signal Numbers

You can provision 10 phone numbers in area code 510 on the development server with:

 ```shell
 $ ./bin/provision-numbers -n 10 -a 510 -u signalboost.ngrok.io
 ```

 Omitting all arguments will default to 1 phone number in the 929 area code on prod:

 ```shell
  $ ./bin/provision-numbers
 ```
