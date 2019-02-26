FROM signalboost_base:latest

MAINTAINER Team Friendo <team-friendo@riseup.net>
LABEL Description="Image for running a signal-boost dispatch service overlaid on top of signal-cli."

# ------------------------------------------------------
# --- Install and Configure DBus
# ------------------------------------------------------

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y \
dbus --fix-missing; 

# Need this to hold the /var/run/dbus/system_bus_socket file descriptor
RUN mkdir -p /var/run/dbus

# Declare permissions for access to the signal-cli message bus
COPY conf/org.asamk.Signal.conf /etc/dbus-1/system.d/

# ------------------------------------------------------
# --- Run!!
# ------------------------------------------------------

ENTRYPOINT ["/signalboost/bin/entrypoint/dispatcher"]
