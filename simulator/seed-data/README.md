# Seed Data for Loadtest Simulator

## What lies here

These files contain data necessary to bootstrap an environment with the following properties:
- a "receiver" signalc instance that has 1000 signal accounts to use as bot "subscribers" to channels under test
- a "sender" signalc instance that has 10 signal accounts to use as signalboost channels under test
- a "sender" signald instance that has 10 signal accounts to use as signalboost channels under test
- a staging (fake) signalserver that knows about all 1020 accounts involved in the test
- zero session data created for any account (so tests may be bootstrapped from a pristine state)


## How to load seed data

spin up database:

```shell
docker-compose -f docker-compose-loadtest.yml up -d db
```

load signalc receiver data (bot subscribers):

```shell
psql postgresql://postgres@localhost:5432 -U postgres -c "create database loadtest_receiver_signalc;"
docker-compose -f docker-compose-loadtest.yml exec -T db psql -U postgres loadtest_receiver_signalc < simulator/seed-data/signalc-1000-numbers-for-subscribers.sql
```

load signalc sender data (channels under test):

```shell
psql postgresql://postgres@localhost:5432 -U postgres -c "create database loadtest_sender_signalc;"
docker-compose -f docker-compose-loadtest.yml exec -T db psql -U postgres loadtest_sender_signalc < simulator/seed-data/signalc-10-numbers-for-channels.sql
```

signald app data (channels under test):

```shell
cd simulator/seed-data
unzip signald-10-numbers-for-channels.zip
sudo su
chown -R root:root signalboost_loadtest_signald_data
rm -rf /var/lib/docker/volumes/signalboost_loadtest_signald_data
mv signalboost_loadtest_signald_data /var/lib/docker/volumes/
```

## How to wipe existing seed data

spin up database:

```shell
docker-compose -f docker-compose-loadtest.yml up -d db
```

get a psql shell and drop signalc data:

```shell
psql postgresql://postgres@localhost:5432 -U postgres -c "drop database loadtest_receiver_signalc;"
psql postgresql://postgres@localhost:5432 -U postgres -c "drop database loadtest_sender_signalc;"
```

remove signald data:

```shell
sudo su
rm -rf /var/lib/docker/volumes/signalboost_loadtest_signald_data
```
