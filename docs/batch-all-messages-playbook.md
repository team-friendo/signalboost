# How to revert to batching all messages to avoid rate limits

## Context

* In MR !179 we introduced a perf enhancement that only batches messages with
  attachments so that no-attachment messages can get through faster
* We did this after having observed in many testing scenarios that no-attachment
  messages did not get rate limited
* However, if under load we observe that no-attachment messages are in fact
  rate-limited, we would like a fast and easy way to restore the old behavior of
  batching all messages whether or not they have attachments
* This playbook provides instructions for doing that!

## Instructions

## Merge the MR

* go to https://0xacab.org/team-friendo/signalboost/merge_requests/182
* click `Resolve WIP Status`
* click `Merge`

## Deploy the fix

on your local machine:

```shell
cd /path/to/signalboost
git checkout master
git pull origin master
make m.ansible deploy
```

wait til you get a notification that the app is up. you did it! celebrate!
