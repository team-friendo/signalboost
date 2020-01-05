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

# Signald attachments break if we use jdk11 (why?!??),
# but buster does not provide a jdk8 installation candidate,
# so we grab one from sid package repository...
RUN echo "deb http://ftp.us.debian.org/debian sid main" \
    | tee -a /etc/apt/sources.list \
    && apt-get update -qq

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    openjdk-8-jdk-headless

ENV JAVA_HOME "/usr/lib/jvm/java-8-openjdk-amd64"

# ------------------------------------------------------
# --- Install and Configure Signald (from source)
# ------------------------------------------------------

# build signald from a given commit hash
ENV REPO_URL "https://git.callpipe.com/finn/signald.git"
ENV RELEASE_COMMIT_HASH "d709c3face5b027c087c6ed71991b0821d448e28"
ENV BRANCH "master"

# if we ever want to build off of an unmerged fork...
# ENV REPO_URL "https://0xacab.org/team-friendo/signald-fork.git"

# hack to avoid halting error on (unnecessary) `sudo` invocations
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y sudo

# fetch repo at desired commit
RUN git init && \
    git remote add origin $REPO_URL && \
    git fetch origin $BRANCH && \
    git reset --hard $COMMIT_HASH

# build from source
RUN make installDist && make setup

# put signald binary on path
RUN ln -s ${PWD}/build/install/signald/bin/signald /usr/local/bin/signald

# ------------------------------------------------------
# --- Configure Environment
# ------------------------------------------------------

WORKDIR /signalboost
ENTRYPOINT /signalboost/bin/entrypoint/signald
