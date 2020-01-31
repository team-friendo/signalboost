# How to handle a Signalboost outage

## Get on prod

Find the IP address for prod in `signalboost/asnisble/inventory`

```shell
ssh -i ~/.ssh/<your_ssh_pubkey> <prod__ip_address>
```
Note:

* you only have 2 guesses to get your ssh password right! be very careful!
* if you get it wrong twice you will be locked out and will need to try ssh'ing
  again from behind a VPN (to get a new IP)

## Inspect the logs

```shell
sudo su
cd /srv/signalboost
docker-compose logs -f
```

* copy/paste anything that seems relevant near the time of the crash and store it
  somewhere secure (preferably encrypted!) on your local machine
* if the crash looks like it was caused by rate-limiting errors for messages
  without attachments, see `batch-all-messages-playbook.md` in this same folder
  for instructions on how to restore batching behavior for all messages (not
  just messages with attachments)

## Restart the app

from `/srv/signalbost`, run:

```
docker-compose down
docker-compose up -d
```

NOTE: the `-d` flag is very important! It makes sure the app runs in daemon mode
and thus will not stop when you close your shell session!

## Ping team with any relevant details

Use a medium of your choice. :)
