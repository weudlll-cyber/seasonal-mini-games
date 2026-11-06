#!/usr/bin/env bash
# @file   ops/test/installer-test.sh
# @module ops/test
# @brief  The installer from a fresh Ubuntu 24.04 to a running instance, both install types, in containers.
#
# Responsibility: throw-away "servers" (ops/test/Dockerfile: systemd as PID 1, privileged,
#                 /var/lib/docker and /var/lib/containerd on anonymous volumes, so the Docker
#                 in them can build and run images), one per case:
#                 standalone — ops/install.sh on a bare IP installs Docker, builds the real app
#                 from a git bundle of the given ref, starts it behind Caddy's internal CA and
#                 waits for /readyz; then HTTPS answers, `smg status`, a backup encrypted for a
#                 fresh age key, the restore drill on it, maintenance on (a new match is
#                 refused) and off, and a re-run of the installer that changes nothing.
#                 nginx — the website behind host nginx, with Mini Games first switched off
#                 there (the installer stops with the website's --mini-games command), then
#                 switched on (the re-run succeeds), and a re-run keeping every answer.
#                 caddy — the website behind its own Caddy, the install and a re-run.
#                 The website cases (./website-cases.sh) use a stand-in website and app; nginx
#                 and Caddy check the route file for real (nginx -t, caddy validate). Every
#                 server is removed at the end, also after a failure, and the work images too.
# Depends on:     docker (with privileged containers), git, ops/test/Dockerfile, ./website-cases.sh
# Used by:        the operator or a night run, by hand (standalone 20–40 minutes, a website case about 5)
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §3, §6, §8
#
# Usage: bash ops/test/installer-test.sh [standalone|nginx|caddy|website|all] [git ref, default HEAD's branch]
#        (website: nginx and caddy; all: every case)
set -euo pipefail
shopt -s inherit_errexit
# Git Bash on Windows rewrites arguments that start with / (such as -v /var/lib/docker) into
# Windows paths: off, and host files reach Docker by paths relative to WORK; git gets
# native paths (native, below).
export MSYS_NO_PATHCONV=1
# native <path>: the path as the host's own programs read it (Windows form under Git Bash).
native() { cygpath -w "$1" 2>/dev/null || printf '%s' "$1"; }

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
WHICH=${1:-all}
REF=${2:-$(git -C "$(native "$REPO")" rev-parse --abbrev-ref HEAD)}
IMAGE=smg-installer-test
WORK=$(mktemp -d)
SERVERS=()

finish() {
  local status=$? name
  for name in "${SERVERS[@]}"; do
    # A failed run shows what the apps said before the server goes (expanded in the server).
    if ((status != 0)); then
      step "app logs on $name"
      # shellcheck disable=SC2016
      on "$name" 'for c in $(docker ps -a --format "{{.Names}}" | grep -- -app-1); do docker logs --tail 60 "$c" 2>&1; done' || true
    fi
    docker rm -f -v "$name" >/dev/null 2>&1 || true
  done
  docker image rm "$IMAGE" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap finish EXIT

step() { printf '\n== %s\n' "$*"; }
fail() {
  printf 'FAILED: %s\n' "$*" >&2
  exit 1
}
# on <server> <command>: a shell command inside the test server, as root.
on() { docker exec "$1" bash -lc "$2"; }
# put <server> <file in WORK> <path>: copies a work file into the server.
put() { (cd "$WORK" && docker cp "$2" "$1:$3"); }

# A fresh server with the source as a git bundle and an age key of its own.
server() {
  local name=$1
  docker rm -f -v "$name" >/dev/null 2>&1 || true
  SERVERS+=("$name")
  docker run -d --name "$name" --hostname "$name" --privileged --cgroupns=private \
    --tmpfs /run --tmpfs /run/lock -v /var/lib/docker -v /var/lib/containerd "$IMAGE" >/dev/null
  for _ in $(seq 1 30); do
    on "$name" 'systemctl is-system-running 2>/dev/null | grep -Eq "running|degraded"' && break
    sleep 1
  done
  put "$name" smg.bundle /root/smg.bundle
  on "$name" "git clone --quiet -b '$REF' /root/smg.bundle /root/smg"
  on "$name" 'apt-get update -q >/dev/null && apt-get install -y -q age >/dev/null'
  on "$name" 'age-keygen -o /root/key.txt 2>&1 | sed -n "s/^Public key: //p" > /root/key.pub'
}

standalone() {
  local s=smg-itest-standalone pub file
  step "standalone: fresh server"
  server "$s"
  pub=$(on "$s" 'cat /root/key.pub')
  step "standalone: install (Docker, image build from $REF, start, /readyz)"
  on "$s" "bash /root/smg/ops/install.sh --type standalone --env prod --address 127.0.0.1 \
    --email ops@example.org --age-key '$pub' --repo /root/smg.bundle --ref '$REF' --yes"
  step "standalone: HTTPS answers"
  on "$s" 'curl -sfk https://127.0.0.1/readyz' | grep -q . || fail "no /readyz over HTTPS"
  on "$s" 'curl -sfk https://127.0.0.1/api/v1/games' | grep -q guess-the-number || fail "no games over HTTPS"
  step "standalone: smg status"
  on "$s" 'smg status' | tee "$WORK/status.txt"
  grep -q 'health:      ready' "$WORK/status.txt" || fail "status is not ready"
  step "standalone: backup and restore drill"
  on "$s" 'smg backup'
  file=$(on "$s" 'ls -1 /var/backups/smg/prod/smg-prod-*.tar.age | tail -1')
  on "$s" "smg restore --drill '$file' --identity /root/key.txt" | tee "$WORK/drill.txt"
  grep -q 'drill passed' "$WORK/drill.txt" || fail "the drill did not pass"
  on "$s" 'systemctl is-enabled smg-backup@prod.timer' | grep -q enabled || fail "no backup timer"
  step "standalone: maintenance on and off"
  on "$s" 'smg maintenance on && smg status | grep -q "maintenance: ON"'
  # The app refuses a new match while it holds (no sign-in needed: it answers first).
  sleep 2
  on "$s" 'curl -sk -o /dev/null -w "%{http_code}" -X POST https://127.0.0.1/api/v1/matches' |
    grep -q 503 || fail "a new match was not refused during maintenance"
  on "$s" 'smg maintenance off'
  step "standalone: a second run changes nothing"
  on "$s" "bash /root/smg/ops/install.sh --yes --age-key '$pub'" | tee "$WORK/rerun.txt"
  grep -q 'Done (0 change(s))' "$WORK/rerun.txt" || fail "the re-run changed something"
}

# shellcheck source-path=SCRIPTDIR
source "$HERE/website-cases.sh"

step "test server image and the source bundle of $REF"
(cd "$HERE" && docker build -q -t "$IMAGE" . >/dev/null)
git -C "$(native "$REPO")" bundle create "$(native "$WORK")/smg.bundle" "$REF"
[[ $WHICH == standalone ]] || stub_app_image
case $WHICH in
  standalone) standalone ;;
  nginx) website_case nginx off-first ;;
  caddy) website_case caddy ;;
  website | all)
    website_case nginx off-first
    website_case caddy
    [[ $WHICH == website ]] || standalone
    ;;
  *) fail "usage: installer-test.sh [standalone|nginx|caddy|website|all] [git ref]" ;;
esac
step "installer test passed ($WHICH, $REF)"
