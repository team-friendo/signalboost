FROM debian:stretch

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
    procps \
    pkg-config \
    python \
    xz-utils \
    wget

# ------------------------------------------------------
# --- Install and Configure JVM
# ------------------------------------------------------

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    openjdk-8-jdk-headless

ENV JAVA_HOME "/usr/lib/jvm/java-8-openjdk-amd64"


# ------------------------------------------------------
# --- Install and Configure Signald
# ------------------------------------------------------

# add signald package repo to sources.list
RUN echo "deb https://updates.signald.org master main" | tee -a /etc/apt/sources.list

# add signing key
RUN curl https://updates.signald.org/apt-signing-key.asc | apt-key add -

# install signald
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y signald

# create file descriptor for socket
RUN mkdir -p /var/run/signald
RUN chown signald:signald /var/run/signald

# create data directory for keystore
# RUN mkdir -p /var/lib/signald/data

# ------------------------------------------------------
# --- Configure Environment
# ------------------------------------------------------

WORKDIR /signalboost
ENTRYPOINT /signalboost/bin/entrypoint/signald
