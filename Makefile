# We need to use bash, not 'sh' (which is bash on osx and something else on linux)
SHELL := /bin/bash

help:  ## print this message
# borrowed from: https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
	@grep -E '^[a-zA-Z_\.-]+:' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":[^#]*(## )?"}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2 }'

###########################
# local workflow commands #
###########################


_.setup: # build docker container, create dbs, run migrations
	./bin/dev/setup

_.update: # re-build docker images, install dependencies, run migrations
	./bin/dev/setup

_.unlock: ## unlock signalboost secrets
	./bin/blackbox/decrypt_all_files


########################
# cli-related commands #
########################

cli.install: ## install the boost cli (puts ./cli/boost-commands on your $PATH)
	sudo ./cli/install

cli.uninstall: ## removes boost cli files from your path
	sudo ./cli/uninstall

# TODO: add aliases to commands here that accept args...


##################
# docker-related #
##################

docker.build.signalboost: ## build the signalboost docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-build signalboost $(TAG)

docker.build.signald: ## build the signald docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-build signald $(TAG)

docker.build.splash: ## build the splash site docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-build splash $(TAG)

docker.push.signalboost: ## push the signalboost docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-push signalboost $(TAG)

docker.push.signald: ## push the signald docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-push signald $(TAG)

docker.push.splash: ## push the splash site docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-push splash $(TAG)

###################
# ansible-related #
###################

ansible.install: ## removes boost cli files from your path
	./ansible/install-ansible

ansible.deploy: # deploy the app to prod
	./bin/deploy

ansible.deploy.crontab: # deploy changes to the crontab on prod
	cd ansible && ansible-playbook -i inventory playbooks/provision_backup_src.yml --tags crontab

ansible.deploy.friendo: # deploy the app to prod
	FRIENDO_DEPLOY=1 ./bin/deploy

ansible.deploy.metrics: # deploy grafana/prometheus to metrics server
	./bin/deploy-metrics

ansible.deploy.staging: # deploy staging
	./bin/blackbox/postdeploy && \
	cd ansible && ansible-playbook -i inventory -e "sb_host=sb_staging env_file=files/.env.staging" playbooks/deploy.yml

ansible.deploy.splash: ## deploy the splash app
	./splash/bin/deploy

ansible.harden.splash: ## harden the server hosting the splash page
	./splash/bin/harden

ansible.harden.staging: # provision staging
	cd ansible && ansible-playbook -i inventory -e "sb_host=sb_staging" playbooks/harden.yml

ansible.provision: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/provision.yml

ansible.provision.backup.src: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/provision_backup_src.yml

ansible.provision.backup.dst: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/provision_backup_dst.yml

ansible.provision.splash: ## provision the splash app
	./splash/bin/provision

ansible.provision.staging: # provision staging
	./bin/blackbox/postdeploy && \
    cd ansible && ansible-playbook -i inventory -e "sb_host=sb_staging" playbooks/provision.yml

ansible.harden: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/harden.yml

ansible.backup: # backup the app from prod to sb_backup host
	cd ansible && ansible-playbook -i inventory playbooks/backup.yml

ansible.repair.db: # repair corrupted postgres write-ahead-log
	cd ansible && ansible-playbook -i inventory playbooks/repair_db.yml

ansible.restore: # restore from backup on sb_backup host to prod
	cd ansible && ansible-playbook -i inventory playbooks/restore.yml

ansible.restart: # restart prod
	cd ansible && ansible-playbook -i inventory playbooks/restart.yml


#######################
# db-related commands #
#######################

db.drop: # drop db
	./bin/dev/drop

db.psql: # get a psql shell on dev db
	./bin/dev/psql

db.migrate.up: # run all migrations
	./bin/dev/migrate

db.migrate.down: # undo last migration
	./bin/dev/migrate-undo

db.migrate.status: # check migration statuses
	./bin/dev/migrate-status

dev.psql: # get a psql shell on dev db
	./bin/dev/psql

prod.psql: # get a psql shell on prod db
	./bin/prod/psql

##########################
# start and stop the app #
##########################

dev.up: ## run signalboost in local dev mode
	docker-compose -f docker-compose.yml -f docker-compose-dev.yml \
	up -d ngrok app

dev.up.v: ## run signalboost in local dev mode with verbose logging
	SIGNALBOOST_VERBOSE_LOG=1 docker-compose -f docker-compose.yml -f docker-compose-dev.yml \
	up -d ngrok app

dev.up.metrics: ## run signalboost in local dev mode with prometheus/grafana
	docker-compose -f docker-compose.yml -f docker-compose-dev.yml \
	up -d

dev.down: ## gracefully stop all signalboost container
	docker-compose -f docker-compose.yml -f docker-compose-dev.yml \
	down

dev.abort: ## force stop all running signalboost containers
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id

dev.logs: ## show logs for all docker containers
	docker-compose -f docker-compose.yml -f docker-compose-dev.yml \
	logs -f

dev.restart: ## force stop and start the app again
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id && \
	docker-compose -f docker-compose.yml -f docker-compose-dev.yml \
	up -d ngrok app

dev.restart.v: ## force stop and start the app again with verbose loggins
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id && \
	SIGNALBOOST_VERBOSE_LOG=1 docker-compose -f docker-compose.yml -f docker-compose-dev.yml \
	up -d ngrok app

dev.restart.metrics: ## force stop and start the app again (with prometheus/grafana)
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id && \
	docker-compose -f docker-compose.yml -f docker-compose-dev.yml \
	up -d

#############
# run tests #
#############

test.all: ## run all unit and e2e tests
	npx eslint app && ./bin/test/unit && ./bin/test/integration && cd signalc && ./gradlew test

test.sb.unit: ## run unit tests
	./bin/test/unit

test.sb.integration: ## run integration tests
	./bin/test/integration

test.sb.lint: ## run linter
	npx eslint app && npx eslint test

test.sb.lint.fix: ## run linter with --fix option to automatically fix what can be
	npx eslint --fix app && npx eslint --fix test

test.sc.all:
	cd signalc && ./gradlew test


##################################
# run and deploy the splash page #
##################################


splash.setup: ## build dev env for docker site (build docker container, install  npm deps)
	./splash/bin/setup

splash.dev.up: ## run splash site in dev mode
	cd splash && docker-compose -f docker-compose-dev.yml up

splash.dev.down: ## shut down splash dev containers
	cd splash && docker-compose -f docker-compose-dev.yml down

splash.build: ## build production version of splash site
	cd splash && docker-compose run --entrypoint 'gatsby build' splash

splash.prod.up: ## run (already-built) version of splash site
	cd splash && docker-compose up

splash.prod.down: ## shut down splash prod containers
	cd splash && docker-compose down

splash.provision: ## deploy the splash app
	./splash/bin/provision

splash.harden: ## harden the server hosting the splash page
	./splash/bin/harden

splash.deploy: ## deploy the splash app
	./splash/bin/deploy

splash.update: ## install new node dependencies and rebuild docker container if needed
	./splash/bin/update
