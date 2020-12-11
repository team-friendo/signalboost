FROM node:14.15.1-buster

MAINTAINER Team Signalboost <signalboost@protonmail.com>
LABEL description="Image for running a signalboost broadcast/hotline service in node.js"

# ------------------------------------------------------
# --- Install System Dependencies
# ------------------------------------------------------

ENV ARCH "x64"

RUN mkdir -p /usr/share/man/man1
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    apt-transport-https \
    build-essential \
    # for inferring ngrok vals in dev
    curl \
    jq \
    # for postgres + nodegyp installs
    libpq-dev \
    python3 \
#    pkg-config \
#    xz-utils \
#    wget \
   --fix-missing

# ------------------------------------------------------
# --- Configure Environment
# ------------------------------------------------------

WORKDIR /signalboost

# ------------------------------------------------------
# --- version
# ------------------------------------------------------

LABEL version="1.0.1"