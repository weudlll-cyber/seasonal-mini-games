# @file   ops/test/Dockerfile
# @module ops/test
# @brief  A fresh Ubuntu 24.04 "server" with systemd as PID 1, for testing ops/install.sh.
#
# Responsibility: the smallest stand-in for a new VPS: Ubuntu 24.04 with systemd (the
#                 installer enables Docker and the backup timer as units) and nothing of the
#                 app. Docker itself is not here: the installer installs it from Docker's
#                 apt repository, as on a real server. Run privileged with its own cgroup
#                 namespace (ops/test/installer-test.sh), so the Docker it installs works.
# Used by:        ops/test/installer-test.sh
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §3

FROM ubuntu:24.04@sha256:24737cef17f4e22b1977df7d9a05e77c4e28b7da5b8911f8d8ccda136bf3573c
ENV container=docker DEBIAN_FRONTEND=noninteractive
# systemd and what a provider's base image usually has (git to clone the source, curl).
RUN apt-get update -q \
  && apt-get install -y -q --no-install-recommends systemd systemd-sysv dbus ca-certificates sudo git curl \
  && rm -rf /var/lib/apt/lists/* \
  && systemctl mask getty.target systemd-logind.service console-getty.service
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
