# We need to use bash, not 'sh' (which is bash on osx and something else on linux)
SHELL := /bin/bash

help:  ## print this message
# borrowed from: https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
	@grep -E '^[a-zA-Z_\.-]+:' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":[^#]*(## )?"}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2 }'

#######################
# high-level commands #
#######################

_.deploy: # deploy the app to prod
	./bin/deploy

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
	./bin/install-ansible


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


##########################
# start and stop the app #
##########################

dev.up: ## run signalboost in local dev mode
	docker-compose -f docker-compose-dev.yml up

dev.down: ## gracefully stop all signalboost container
	docker-compose -f docker-compose-dev.yml down

dev.abort: ## force stop all running signalboost containers
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id

dev.restart: ## force stop and start the app again
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id && \
	docker-compose -f docker-compose-dev.yml up

#############
# run tests #
#############

test.all: ## run all unit and e2e tests
	./bin/test/unit && ./bin/test/e2e

test.unit: ## run unit tests
	./bin/test/unit

test.e2e: ## run e2e tests
	./bin/test/e2e

test.lint: ## run linter
	npx eslint app


##################################
# run and deploy the splash page #
##################################


splash.deploy: ## deploy the splash app
	cd splash && ./bin/deploy

splash.dev: ## run splash site in dev mode
	cd splash && docker-compose -f docker-compose-dev.yml up

splash.build: ## build production version of splash site
	cd splash && docker-compose run --entrypoint 'gatsby build' splash

splash.prod: ## run (already-built) version of splash site
	cd splash && docker-compose up

