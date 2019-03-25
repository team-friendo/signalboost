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
$ sudo -u signal-booster gpg --import signal-booster-privkey.asc
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
