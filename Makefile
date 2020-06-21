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


##########################
# docker/ansible-related #
##########################

docker.build: ## rebuild the signalboost & signald docker images 
	./bin/build-docker

ansible.install: ## removes boost cli files from your path
	./ansible/install-ansible

ansible.deploy: # deploy the app to prod
	./bin/deploy

ansible.provision: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/provision.yml

ansible.provision_backup_src: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/provision_backup_src.yml

ansible.provision_backup_dst: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/provision_backup_dst.yml

ansible.harden: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/harden.yml

ansible.backup: # backup the app from prod to sb_backup host
	cd ansible && ansible-playbook -i inventory playbooks/backup.yml

ansible.restore: # restore from backup on sb_backup host to prod
	cd ansible && ansible-playbook -i inventory playbooks/restore.yml


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


##########################
# start and stop the app #
##########################

dev.up: ## run signalboost in local dev mode
	docker-compose -f docker-compose-dev.yml up -d

dev.down: ## gracefully stop all signalboost container
	docker-compose -f docker-compose-dev.yml down

dev.abort: ## force stop all running signalboost containers
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id

dev.logs: ## show logs for all docker containers
	docker-compose -f docker-compose-dev.yml logs -f

dev.restart: ## force stop and start the app again
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id && \
	docker-compose -f docker-compose-dev.yml up

#############
# run tests #
#############

test.all: ## run all unit and e2e tests
	npx eslint app && ./bin/test/unit && ./bin/test/e2e

test.unit: ## run unit tests
	./bin/test/unit

test.e2e: ## run e2e tests
	./bin/test/e2e

test.lint: ## run linter
	npx eslint app && npx eslint test

test.lint.fix: ## run linter with --fix option to automatically fix what can be
	npx eslint --fix app && npx eslint --fix test



##################################
# run and deploy the splash page #
##################################


splash.setup: ## build dev env for docker site (build docker container, install  npm deps)
	./splash/bin/setup

splash.dev: ## run splash site in dev mode
	cd splash && docker-compose -f docker-compose-dev.yml up

splash.build: ## build production version of splash site
	cd splash && docker-compose run --entrypoint 'gatsby build' splash

splash.prod: ## run (already-built) version of splash site
	cd splash && docker-compose up

splash.deploy: ## deploy the splash app
	./splash/bin/deploy

splash.update: ## install new node dependencies and rebuild docker container if needed
	./splash/bin/update
