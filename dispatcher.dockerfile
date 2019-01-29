FROM debian:stretch

MAINTAINER Team Friendo <team-friendo@riseup.net>
LABEL Description="Image for running a signal-boost dispatch service overlaid on top of signal-cli."

# ------------------------------------------------------
# --- Install System Dependencies
# ------------------------------------------------------

RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    apt-transport-https \
    curl \
    git \
    gnupg \
    procps \
    wget

# ------------------------------------------------------
# --- Install and Configure DBus

# TODO: remove dbus-x11?

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    dbus --fix-missing; 

# Need this to hold the /var/run/dbus/system_bus_socket file descriptor
RUN mkdir -p /var/run/dbus

# ------------------------------------------------------
# --- Install and Configure JVM

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    openjdk-8-jdk-headless

ENV JAVA_HOME "/usr/lib/jvm/java-8-openjdk-amd64"

# ------------------------------------------------------
# --- Install, Configure Node.js

ENV NODE_VERSION 8.15.0
ENV NVM_DIR "$HOME/.nvm"

# install node
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash && \
echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' >> ${HOME}/.bash_profile && \
. ${HOME}/.bash_profile && \
nvm install ${NODE_VERSION} && \
nvm use ${NODE_VERSION}

# install yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
apt-get update -q && \
apt-get install -y yarn

# ------------------------------------------------------
# --- Install, Configure Supervisord (Golang version)

# see: https://github.com/ochinchina/supervisord

# Copy supervisord binary from Dockerhub
COPY --from=ochinchina/supervisord:latest /usr/local/bin/supervisord /usr/local/bin/supervisord

# ------------------------------------------------------
# --- Install and Configure Signal-Cli
# ------------------------------------------------------

ENV SIGNAL_CLI_VERSION "0.6.2"

# Dependencies
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
    libpq-dev \
    libunixsocket-java

# Install from repo
RUN wget https://github.com/AsamK/signal-cli/releases/download/v"${SIGNAL_CLI_VERSION}"/signal-cli-"${SIGNAL_CLI_VERSION}".tar.gz; \
    tar xf signal-cli-"${SIGNAL_CLI_VERSION}".tar.gz -C /opt; \
    ln -sf /opt/signal-cli-"${SIGNAL_CLI_VERSION}"/bin/signal-cli /usr/local/bin; \
    rm -rf signal-cli-"${SIGNAL_CLI_VERSION}".tar.gz;

# Declare permissions for access to the signal-cli message bus
COPY conf/org.asamk.Signal.conf /etc/dbus-1/system.d/

# ------------------------------------------------------
# --- Prepare environment
# ------------------------------------------------------

# Copy bash scripts
COPY bin/ /bin/

# Copy supervisord configuration
COPY conf/supervisord.conf /conf/

# Create log files
RUN mkdir /logs; \
    touch /logs/dbus.log; \
    touch /logs/dbus.errors; \
    touch /logs/signal-cli.log; \
    touch /logs/signal-cli.errors; \
    touch /logs/signal-boost.log; \
    touch /logs/signal-boost.errors;

# for debugging...
# RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
#     emacs

CMD ["/bin/bash"]

# ------------------------------------------------------
# --- Run!!

# CMD ["supervisord -c /conf/supervisord.conf -d"]

# TODO (aguestuser|Mon 28 Jan 2019)
# - currently we omit the CMD call b/c we cannot ensure that
#   CHANNEL_PHONE_NUMBER is already registered/verified at container runtime.
#   (and thus: that `signal-cli` will start correctly)
# - once we extract an orchestrator service, it will 
#   (1) handle registration requests (generating necessary key material on file system)
#   (2) spin up a container with a pre-registered number specified as CHANNEL_PHONE_NUMBER
# - provided we mount the dir with the key material into the new container,
#   we will then be able 

