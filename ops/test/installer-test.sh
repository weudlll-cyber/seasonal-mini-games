#!/usr/bin/env bash
# @file   ops/test/installer-test.sh
# @module ops/test
# @brief  The installer from a fresh Ubuntu 24.04 to a running, backed-up instance, in containers.
#
# Responsibility: two throw-away "servers" (ops/test/Dockerfile: systemd as PID 1, privileged,
#                 /var/lib/docker on an anonymous volume so the Docker they install works):
#                 standalone — ops/install.sh on a bare IP installs Docker, builds the app
#                 from a git bundle of the given ref, starts it behind Caddy's internal CA and
#                 waits for /readyz; then HTTPS answers, `smg status`, a backup encrypted for a
#                 fresh age key, the restore drill on it, maintenance on and off, and a re-run
#                 of the installer that changes nothing. website — a stand-in for the Seasonal
#                 Entertainment website (compose project seasonal-site, service caddy, with
#                 the routes import its DEPLOYMENT.md sets up), then this installer and Seasonal
#                 Bingo Royale's (from its committed tree, read-only) as the website type side
#                 by side: both answer through the website's Caddy under their paths, with no
#                 shared container, volume, port, network alias, group or timer. Both servers
#                 are removed at the end, also after a failure.
# Depends on:     docker (with privileged containers), git, ops/test/Dockerfile, ops/compose.yml
# Used by:        the operator or a night run, by hand (it takes 20–40 minutes)
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §3, §6, §8
#
# Usage: bash ops/test/installer-test.sh [standalone|website|all] [git ref, default HEAD's branch]
#        BINGO_REPO=<path of a Bingo clone> BINGO_COMMIT=<commit> for the website part.
set -euo pipefail
shopt -s inherit_errexit
# Git Bash on Windows rewrites arguments that start with / (such as -v /var/lib/docker) into
# Windows paths: off, and host files reach Docker by paths relative to WORK.
export MSYS_NO_PATHCONV=1

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
WHICH=${1:-all}
REF=${2:-$(git -C "$REPO" rev-parse --abbrev-ref HEAD)}
BINGO_REPO=${BINGO_REPO:-$REPO/../seasonal-bingo-royale}
BINGO_COMMIT=${BINGO_COMMIT:-d294585}
IMAGE=smg-installer-test
# The website's Caddy stand-in runs the same pinned Caddy as the standalone stack.
CADDY_IMAGE=$(sed -n 's/^ *image: *\(caddy:.*\)$/\1/p' "$REPO/ops/compose.yml")
WORK=$(mktemp -d)
SERVERS=()

finish() {
  local name
  for name in "${SERVERS[@]}"; do docker rm -f -v "$name" >/dev/null 2>&1 || true; done
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
    --tmpfs /run --tmpfs /run/lock -v /var/lib/docker "$IMAGE" >/dev/null
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
  on "$s" 'smg maintenance on && smg status | grep -q "maintenance: ON" && smg maintenance off'
  step "standalone: a second run changes nothing"
  on "$s" "bash /root/smg/ops/install.sh --yes --age-key '$pub'" | tee "$WORK/rerun.txt"
  grep -q 'Done (0 change(s))' "$WORK/rerun.txt" || fail "the re-run changed something"
}

# The stand-in for the website: its compose project and Caddy as its DEPLOYMENT.md sets them
# up (routes imported from deploy/site/routes/), plain HTTP inside the test server.
fake_website() {
  local s=$1
  mkdir -p "$WORK/site/routes"
  printf '# the routes of the installed games\n' >"$WORK/site/routes/site.caddy"
  cat >"$WORK/site/Caddyfile" <<'EOF'
{
	auto_https off
}
:80 {
	import /etc/caddy/routes/*.caddy
	respond "the website" 200
}
EOF
  cat >"$WORK/site/docker-compose.yml" <<EOF
name: seasonal-site
services:
  caddy:
    image: $CADDY_IMAGE
    environment:
      SITE_DOMAIN: localhost
    ports: ['80:80']
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./routes:/etc/caddy/routes:ro
EOF
  put "$s" site /root/site
  on "$s" 'cd /root/site && docker compose up -d --wait'
}

# Seasonal Bingo Royale beside it, from its committed tree only (never its working tree).
bingo_beside() {
  local s=$1 pub=$2
  git -C "$BINGO_REPO" archive --format=tar --prefix=bingo/ "$BINGO_COMMIT" >"$WORK/bingo.tar"
  put "$s" bingo.tar /root/bingo.tar
  on "$s" 'cd /root && tar -xf bingo.tar && cd bingo && git init -q -b master && git add -A'
  on "$s" 'cd /root/bingo && git -c user.email=t@example.org -c user.name=test commit -qm tree'
  on "$s" "bash /root/bingo/ops/install.sh --type website --env prod --email ops@example.org \
    --age-key '$pub' --repo /root/bingo --ref master --yes"
  on "$s" 'cp /opt/sbr/website-bingo.caddy /root/site/routes/bingo.caddy'
}

website() {
  local s=smg-itest-website pub
  step "website: fresh server with Docker and the website"
  server "$s"
  pub=$(on "$s" 'cat /root/key.pub')
  on "$s" 'apt-get install -y -q docker.io docker-compose-v2 >/dev/null'
  on "$s" 'systemctl enable --now docker >/dev/null'
  fake_website "$s"
  step "website: Seasonal Mini Games as the website type"
  on "$s" "bash /root/smg/ops/install.sh --type website --env prod --email ops@example.org \
    --age-key '$pub' --repo /root/smg.bundle --ref '$REF' --yes"
  on "$s" 'cp /opt/smg/website-mini-games.caddy /root/site/routes/mini-games.caddy'
  step "website: Seasonal Bingo Royale beside it (commit $BINGO_COMMIT)"
  bingo_beside "$s" "$pub"
  on "$s" 'docker exec seasonal-site-caddy-1 caddy reload --config /etc/caddy/Caddyfile'
  step "website: both answer through the website's Caddy"
  on "$s" 'curl -sf http://localhost/games/mini-games/api/v1/games' | grep -q guess-the-number ||
    fail "mini games not reachable"
  on "$s" 'curl -sf http://localhost/games/bingo/readyz' | grep -q . || fail "bingo not reachable"
  on "$s" 'curl -s http://localhost/' | grep -q 'the website' || fail "the website lost its pages"
  step "website: nothing shared"
  on "$s" 'docker ps --format "{{.Names}} {{.Ports}}"' | tee "$WORK/ps.txt"
  if grep -Eq '^(smg|sbr)-prod-app-1 .*->' "$WORK/ps.txt"; then fail "an app publishes a host port"; fi
  [[ $(on "$s" 'docker volume ls -q' | grep -c '_pgdata$') == 2 ]] || fail "the databases share a volume"
  on "$s" 'systemctl is-enabled smg-backup@prod.timer sbr-backup@prod.timer' >/dev/null ||
    fail "the backup timers are not both there"
  on "$s" 'smg status && sbr status' >/dev/null
}

step "test server image and the source bundle of $REF"
(cd "$HERE" && docker build -q -t "$IMAGE" . >/dev/null)
git -C "$REPO" bundle create "$WORK/smg.bundle" "$REF" 2>/dev/null
case $WHICH in
  standalone) standalone ;;
  website) website ;;
  all)
    standalone
    website
    ;;
  *) fail "usage: installer-test.sh [standalone|website|all] [git ref]" ;;
esac
step "installer test passed ($WHICH, $REF)"
