# ------------------------------------------------------
# --- Build Gradle Image
# ------------------------------------------------------

ARG GRADLE_VERSION="6.7.1"
FROM gradle:${GRADLE_VERSION}-jdk11 as gradle-image

MAINTAINER Signalboost <signalboost@riseup.net>
LABEL description="Image for running signalc -- kotlin signal client -- in JVM"

# ------------------------------------------------------
# --- Build JDK Image
# ------------------------------------------------------

FROM azul/zulu-openjdk-debian:11

# ------------------------------------------------------
# --- Copy Gradle files into JDK Image

ENV GRADLE_HOME /opt/gradle
ENV GRADLE_VERSION "6.7.1"

# copy gradle user files
COPY --from=gradle-image /home/gradle /home/gradle
RUN ln -s /home/gradle/.gradle /root/.gradle

# copy gradle
COPY --from=gradle-image /opt/gradle /opt/gradle
RUN rm -rf /usr/bin/gradle
RUN ln --symbolic /opt/gradle/bin/gradle /usr/bin/gradle

# set the build cache
ENV GRADLE_USER_HOME /home/gradle/.gradle

# ------------------------------------------------------
# --- Configure Environment

# set locale
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8
RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && locale-gen

# copy signal's custom truststore from build context into working directory root
WORKDIR /signalc
COPY signalc/whisper.store /signalc/whisper.store
ENV WHISPER_STORE_PASSWORD "whisper"

# make sure there is a directory to house sockets!
RUN mkdir /signalc/sock
# and one to house attachments!
RUN mkdir /signalc/attachments

# install netcat-openbsd for debugging
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y netcat-openbsd

# ---------------
# --- version

LABEL version="1.0.4"
