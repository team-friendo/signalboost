# Playbook for re-registering signal numbers

Author: aguestuser
Last updated: 2020-08-06

## Purpose

Sometimes the signald keystore for a channel's phone number gets in a borked state and the only way to recover is to delete the keystore and re-register the phone number in order to force signald to rebuild the keystore from scratch.

This is a guide for doing so, which assumes the (worst-case) scenario that your signalboost instance's IP has been blacklisted by Signal and must always submit a catpcha token in order to complete the registration process.

## Steps

### 1. ON PROD: safely remove the old keystore

Get to project root as sudo:

``` shell
sudo su
cd /srv/signalboost
```
Shut down signalboost, delete the keystore and message caches for `PHONE_NUMBER` (replacing `PHONE_NUMBER` with an appropriately formated e164 phone number) and restart signalboost:

``` shell

docker-compose down && \
rm -rf /var/lib/docker/volumes/signalboost_signal_data/_data/+19478005717*  \
&& docker-compose --env-file .env up -d
```
Note: if you want to do this for multiple numbers at the same time, replace line 2 above with several `rm -rf` statements.

### 2. ON LAPTOP: register the number with a captcha token

Get the captcha token by doing the following:

* visit https://signalcaptchas.org/registration/generate.html
* open your browsers network inspector dev tool
* complete the captcha
* watch for a resource in the network inspector that is red and starts with `signalcaptcha://`
* double click this resource, which will try to direct your browser to it
* delete the `signalcatpcha://` directive and copy everything else that remains
* this is your captcha token
* NOTE: you must use this relatively quickly as the captcha token expires!!!

Re-register the phone number with:

``` shell
boost register -p PHONE_NUMBER -c CAPTCHA_TOKEN
```
### 3. ON PROD: restart signalboost

This will cause signald to read the newly registered keystore into memory:

``` shell
docker-compose down && docker-compose --env-file .env up -d
```
### 4. ON LAPTOP: verify it worked

Check the signald logs in grafana (metrics.signalboost.info) to make sure (1) the registration worked, (2) signald has completely restarted:
* if registration worked, you should see a log line about registering (with `voice: false`) and a log line about submitting the 6 digit registration code
* if registration did not work you will see either:
  * a `Captcha Required` error and no registering log line. This likely indicates that the captcha token expired before you submited int
  * a `NonSuccessfulResponseCodeException: Bad response: 400` error. It is unclear what this means. You should likely try again. Maybe wait a while first?
* you can tell signald is completely restarted b/c it will stop reporting `created new Manager for ____` log lines

Finally: test the channel!
* send `INFO` to the phone number to see that it is in good working order
