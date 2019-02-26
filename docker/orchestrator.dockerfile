FROM signalboost_base:latest

MAINTAINER Team Friendo <team-friendo@riseup.net>
LABEL Description="Image for running a signal-boost services overlaid on top of signal-cli."

# ------------------------------------------------------
# --- Run!!

ENTRYPOINT ["/signalboost/bin/entrypoint/orchestrator"]
