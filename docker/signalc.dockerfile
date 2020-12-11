FROM azul/zulu-openjdk-debian:11

MAINTAINER Signalboost <signalboost@riseup.net>
LABEL description="Image for running signalc -- kotlin signal client -- in JVM"

# ------------------------------------------------------
# --- Install JDK
# ------------------------------------------------------

# ------------------------------------------------------
# --- Configure Environment
# ------------------------------------------------------

WORKDIR /signalc

# ---------------
# --- version

LABEL version="1.0.0"
