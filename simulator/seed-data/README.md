# Seed Data for Loadtest Simulator

## What lies here

These files contain data necessary to bootstrap an environment with the following properties:
- a signalc instance simulating load that has 1000 signal accounts to use as bot "subscribers" to channels under test
- a signalc instance under test that has 10 signal accounts to use as signalboost channels
- a signald instance under test that has 10 signal accounts to use as signalboost channels
- a staging (fake) signalserver that knows about all 1020 accounts involved in the test
- zero session data created for any account (so tests may be bootstrapped from a pristine state)

## How to load seed data

signalc simulator data (bot subscribers):

```shell
docker-compose -f docker-compose-loadtest.yml exec -T db psql -U postgres signalc_load_test_simulator < signalc-1000-numbers-for-subscribers.sql
```

signalc app data (channels under test):

```shell
docker-compose -f docker-compose-loadtest.yml exec -T db psql -U postgres signalc_load_test_app < signalc-10-numbers-for-channels.sql
```

signald app data (channels under test):

```shell
cd simulator/seed-data
unzip signald-10-numbers-for-channels.zip
sudo su
chown -R root:root signalboost_loadtest_signald_data
mv signalboost_loadtest_signald_data /var/lib/docker/volumes/
```
