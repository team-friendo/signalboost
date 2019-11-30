# Splash Site

This is the signalboost splash site! It is undercodumented!

Here are a few scripts to do things with it!

1. [Running locally](#dev)
  1. [Dockerized version](#with-docker)
  1. [Non-Dockerized version](#no-docker)
1. [Deploying to prod](#deploy)

## Running Site for Local Dev <a name="dev"></a>

### Dockerized version <a name="with-docker"></a>

Install Docker CE:

* https://docs.docker.com/v17.12/install/

Install `docker-compose`

``` shell
pip install docker-compose
```

Run in dev mode:

``` shell
cd path/to/signalboost
yarn splash:dev
```

(Note: hot reloading won't work b/c of docker network problems we haven't solved, you'll have to refresh the page after edits.)

Build and run prod version:

``` shell
cd path/to/signalboost
yarn splash:prod
```

### Non-Dockerized version <a name="no-docker"></a>

This will support hot reloading but might be harder to get setup! :)

Install:

``` shell
yarn global add gatsby-cli
cd /path/to/signalboost/splash
yarn install
```

Run in dev mode:

``` shell
gatsby develop
```

Build and run in prod mode:

``` shell
gatsby build
gatsby serve
```

## Deploy Changes to prod <a name="deploy"></a>

``` shell
cd path/to/signalboost
yarn splash:deploy
```
