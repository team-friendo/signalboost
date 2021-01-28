# Playbook: migrating to a new server

- [ ] install os and set up ssh keys (if necessary)
- [ ] run base ansible playbooks on sb2: provision, provision.backup.source, harden, deploy
- [ ] edit inventory to point to sb1, run backup
- [ ] turn off sb1
- [ ] edit DNS records for api, signald-0...9 to point to sb2
- [ ] edit inventory to point to sb2, run restore
- [ ] verify restoration worked on sb2 (list contents of keystore, count channel and memberships in psql)
- [ ] restart sb2 and verify tooling works by running `make ansible.deploy` pointed at sb2
- [ ] send `INFO` to DIAGNOSTICS channel
- [ ] edit local .env file to point to sb2, use `boost list-channels`
- [ ] commit changes to .env in blackbox, submit MR
- [ ] wipe sb1, comment out crontab entry for backup job!
- [ ] write the team
