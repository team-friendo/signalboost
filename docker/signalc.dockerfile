# ---------------------------------------------------------------
# --- Inherit base (gradle + jvm) image w/ configured filesystem
# ---------------------------------------------------------------

FROM registry.0xacab.org/team-friendo/signalboost/signalc-dev as base
MAINTAINER Signalboost <signalboost@riseup.net>
LABEL description="Image for running signalc -- kotlin signal client -- in JVM"
ARG commit_hash
LABEL version=$commit_hash

# ------------------------------------------------------
# --- Copy Jar
# ------------------------------------------------------
COPY signalc/build/libs/signalc-${commit_hash}.jar /signalc/run/signalc.jar

# ------------------------------------------------------
# --- Define entrypoint
# ------------------------------------------------------

ENV SIGNALC_COMMIT_HASH $commit_hash
ENTRYPOINT ["java", "-jar", "/signalc/run/signalc.jar"]