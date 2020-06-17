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
    software-properties-common \
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
#RUN echo "deb http://ftp.us.debian.org/debian sid main" \
#    | tee -a /etc/apt/sources.list \
#    && apt-get update -qq

# We install sudo as a hack to get around halting errors
# in make commands that (needlessly) invoke it
#RUN apt-get update -qq
#RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
#        openjdk-8-jdk-headless \
#        sudo

#ENV JAVA_HOME "/usr/lib/jvm/java-8-openjdk-amd64"

RUN wget -qO - https://adoptopenjdk.jfrog.io/adoptopenjdk/api/gpg/key/public | apt-key add -
RUN add-apt-repository --yes https://adoptopenjdk.jfrog.io/adoptopenjdk/deb/
RUN apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y adoptopenjdk-8-hotspot

ENV JAVA_HOME "/usr/lib/jvm/adoptopenjdk-8-hotspot-amd64"

# ------------------------------------------------------
# --- Install and Configure Signald (from source)
# ------------------------------------------------------

# store most recent HEAD of master...
# ENV RELEASE_COMMIT_HASH "ad69e4bfd06fec18793cb073415e1a22685ae2d5"
ENV RELEASE_COMMIT_HASH "b66e7138cefef760f5b7e098cdfc2abb097bba60"

# hack to avoid halting error on (unnecessary) `sudo` invocations
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y sudo

# if we ever want to build off of an unmerged fork...
# ENV REPO_URL "https://0xacab.org/team-friendo/signald-fork.git"

# build signald from a given commit hash
ENV REPO_URL "https://git.callpipe.com/finn/signald.git"
ENV COMMIT_HASH "d709c3face5b027c087c6ed71991b0821d448e28"
ENV BRANCH "master"

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
