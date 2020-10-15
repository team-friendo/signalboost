FROM azul/zulu-openjdk-debian:8
# Signald attachments break if we use jdk11 (why?!??)

LABEL maintainer="Team Friendo <team-friendo@riseup.net>"
LABEL description="Image for running a signal-boost service overlaid on top of signal-cli."

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
# --- Install datadog java agent
# ------------------------------------------------------

RUN mkdir -p /var/lib/dd
RUN wget -O /var/lib/dd/dd-java-agent.jar 'https://repository.sonatype.org/service/local/artifact/maven/redirect?r=central-proxy&g=com.datadoghq&a=dd-java-agent&v=LATEST'

# ------------------------------------------------------
# --- Install and Configure Signald (from source)
# ------------------------------------------------------

# We install sudo as a hack to get around halting errors
# in make commands that (needlessly) invoke it
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y sudo

# build signald from a given commit hash

ENV REPO_URL "https://0xacab.org/team-friendo/signald-fork.git"
ENV BRANCH "main"
ENV COMMIT_HASH "7c5fb96aaf714d3603985ed5cec114f8c93f4ec3"

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

EXPOSE 9010
WORKDIR /signalboost
ENTRYPOINT /signalboost/bin/entrypoint/signald

# ------------------
# Version
# ------------------
LABEL version="1.0.11"
