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

_.build_docker: ## rebuild the signalboost & signald docker images 
	./bin/build-docker

_.install_cli: ## install the boost cli (puts ./cli/boost-commands on your $PATH)
	sudo ./cli/install

_.uninstall_cli: ## removes boost cli files from your path
	sudo ./cli/uninstall

_.install_ansible: ## removes boost cli files from your path
	./bin/install-ansible


#####################
# secret management #
#####################

secrets.unlock: ## unlock signalboost secrets
	./bin/blackbox/decrypt_all_files

secrets.source: ## export secrets as global env vars by sourcing .env
	echo "you need to run `set -a && source .env && set +a`"


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

up.dev: ## run signalboost in local dev mode
	docker-compose -f docker-compose-dev.yml up

up.prod: ## run signalboost in prod mode
	docker-compose up -d

down.soft: ## gracefully stop all signalboost container
	docker-compose down

down.force: ## force stop all running signalboost containers
	docker rm -f `docker ps --filter name=signalboost_* -aq`

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



