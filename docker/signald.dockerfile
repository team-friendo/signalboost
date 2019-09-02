FROM debian:buster

MAINTAINER Team Friendo <team-friendo@riseup.net>
LABEL Description="Image for running a signal-boost service overlaid on top of signal-cli."

# ------------------------------------------------------
# --- Install System Dependencies
# ------------------------------------------------------

ENV ARCH "x64"

RUN mkdir -p /usr/share/man/man1
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    apt-transport-https \
    build-essential \
    curl \
    git \
    gnupg \
    locales \
    netcat-openbsd \
    procps \
    pkg-config \
    python \
    xz-utils \
    wget \
    --fix-missing

# ------------------------------------------------------
# --- Set locale (necessary for proper UTF-8 encoding)
# ------------------------------------------------------

RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen

ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8
ENV LC_CTYPE en_US.UTF-8


# ------------------------------------------------------
# --- Install and Configure JVM
# ------------------------------------------------------

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    openjdk-11-jdk-headless

ENV JAVA_HOME "/usr/lib/jvm/java-11-openjdk-amd64"


# ------------------------------------------------------
# --- Install and Configure Signald
# ------------------------------------------------------

ENV RELEASE_COMMIT_HASH "ad69e4bfd06fec18793cb073415e1a22685ae2d5"

# hack to avoid halting error on (unnecessary) `sudo` invocations
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y sudo

# fetch repo at desired commit
RUN git init && \
    git remote add origin https://git.callpipe.com/finn/signald.git && \
    git fetch origin master && \
    git reset --hard $RELEASE_COMMIT_HASH

# build from source
RUN make installDist && make setup

# put signald binary on path
RUN ln -s ${PWD}/build/install/signald/bin/signald /usr/local/bin/signald

# ------------------------------------------------------
# --- Configure Environment
# ------------------------------------------------------

WORKDIR /signalboost
ENTRYPOINT /signalboost/bin/entrypoint/signald
