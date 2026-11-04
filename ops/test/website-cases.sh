#!/usr/bin/env bash
# @file   ops/test/website-cases.sh
# @module ops/test
# @brief  The installer test's website cases: a stand-in website behind host nginx or its own Caddy, then ops/install.sh --type website.
#
# Responsibility: on a fresh test server (installer-test.sh's `server`) with Docker: the
#                 stand-in website as the website's installer leaves it (compose project
#                 seasonal-site in <checkout>/deploy/site with its site container,
#                 ./stub-website.py, on port 3800; nginx mode: host nginx with
#                 `include /etc/seasonal/routes/*.conf;`, /etc/seasonal/routes/ and
#                 /etc/seasonal/site-local-port; Caddy mode: its Caddy importing
#                 /etc/caddy/routes/*.caddy from deploy/site/routes/), and the app as
#                 ./stub-app.py, loaded as the image the installer would build (smg-app:<commit>),
#                 so the installer, not the app, is under test. A case may start with Mini Games
#                 switched off on the website: the first run must stop with the website's
#                 --mini-games command and change nothing; then the stand-in switches it on (the
#                 token in /etc/seasonal/games-sync-token) and the next run succeeds. Checks
#                 through the website: the app answers, the route file is 0600 and its secret is
#                 never printed, a website member is signed in with name, host right and steps
#                 (so the website saw no secret and got X-Original-Method), a visitor without a
#                 session ends at the website's login, forged identity headers and secrets reach
#                 the app on no route, nor past the proxy, metrics 404, the app's own ports and
#                 subnet differ from Bingo's, `smg status` names the sign-in mode, the authorize
#                 endpoint's 204 and the feed's last success; a re-run changes nothing.
#                 Sourced by installer-test.sh (its on, put, server, step, fail, WORK, REF).
# Depends on:     ./stub-website.py, ./stub-app.py, ../install.sh, docker
# Spec:           docs/spec/10-repository-structure.md §6; Bingo ops/test/website-vps.sh

PY_IMAGE=python:3.12-alpine@sha256:e6dae589c1c05976188fd3bd019afd091445fc533ed2ea29001beddc7368a9c8
# The website's own pinned Caddy (its deploy/site/docker-compose.yml).
SITE_CADDY_IMAGE=caddy:2.11.7-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f
SITE=/root/website/deploy/site
H='-H Host:example.org'
URL=http://127.0.0.1/games/mini-games

# The stand-in app as the image of $REF's commit (built once on this machine, loaded per server).
stub_app_image() {
  local tag
  tag="smg-app:$(git -C "$(native "$REPO")" rev-parse --short=12 "$REF^{commit}")"
  mkdir -p "$WORK/app"
  cp "$HERE/stub-app.py" "$WORK/app/"
  printf 'FROM %s\nCOPY stub-app.py /stub-app.py\nUSER 10001\nCMD ["python3", "-u", "/stub-app.py"]\n' "$PY_IMAGE" >"$WORK/app/Dockerfile"
  (cd "$WORK/app" && docker build -q -t "$tag" . >/dev/null)
  docker save "$tag" -o "$(native "$WORK")/stub-app.tar"
  docker image rm "$tag" >/dev/null
}

site_compose() {
  local mode=$1
  cat <<EOF
name: seasonal-site
services:
  site:
    image: $PY_IMAGE
    command: ['python3', '-u', '/stub.py']
    environment: { PUBLIC_ORIGIN: 'https://example.org' }
    volumes: ['./stub-website.py:/stub.py:ro', './state:/state:ro', '/etc/seasonal:/etc/seasonal:ro']
EOF
  if [[ $mode == nginx ]]; then
    echo "    ports: ['127.0.0.1:3800:3800']"
    return 0
  fi
  cat <<EOF
  caddy:
    image: $SITE_CADDY_IMAGE
    environment: { SITE_DOMAIN: example.org }
    ports: ['80:80']
    volumes: ['./Caddyfile:/etc/caddy/Caddyfile:ro', './routes:/etc/caddy/routes:ro']
EOF
}

# The website's own proxy configuration, as its installer writes it (routes included).
site_proxy_files() {
  mkdir -p "$WORK/website/state" "$WORK/website/routes"
  cp "$HERE/stub-website.py" "$WORK/website/"
  cat >"$WORK/website/Caddyfile" <<'EOF'
{
	auto_https off
}
http://{$SITE_DOMAIN} {
	reverse_proxy site:3800
	import /etc/caddy/routes/*.caddy
	respond /api/games/mini-games/account-changes* 404
}
EOF
  cat >"$WORK/website/nginx-site" <<'EOF'
server {
    listen 80 default_server;
    server_name example.org;
    include /etc/seasonal/routes/*.conf;
    location ^~ /api/games/mini-games/account-changes { deny all; }
    location / { proxy_pass http://127.0.0.1:3800; proxy_set_header Host $host; }
}
EOF
}

# website_server <name> <mode>: a fresh server with Docker, the stand-in website and the app image.
website_server() {
  local s=$1 mode=$2
  server "$s"
  on "$s" 'apt-get install -y -q docker.io docker-compose-v2 >/dev/null && systemctl enable --now docker >/dev/null'
  put "$s" stub-app.tar /root/stub-app.tar
  on "$s" 'docker load -q -i /root/stub-app.tar'
  site_proxy_files
  site_compose "$mode" >"$WORK/website/docker-compose.yml"
  on "$s" "mkdir -p $SITE /etc/seasonal && chmod 755 /etc/seasonal"
  put "$s" website/. "$SITE"
  if [[ $mode == nginx ]]; then
    on "$s" 'apt-get install -y -q nginx >/dev/null'
    on "$s" "install -d -m 755 /etc/seasonal/routes && echo 3800 >/etc/seasonal/site-local-port && cp $SITE/nginx-site /etc/nginx/sites-available/default"
    on "$s" 'nginx -t -q && systemctl reload nginx'
  fi
  on "$s" "cd $SITE && docker compose up -d --quiet-pull --wait"
}

# The website's installer with --mini-games: the token (root, 600) and the switch.
switch_mini_games_on() {
  on "$1" 'umask 077 && openssl rand -hex 32 >/etc/seasonal/games-sync-token'
  on "$1" "touch $SITE/state/mini-games-on"
}

install_website() {
  local s=$1 pub
  pub=$(on "$s" 'cat /root/key.pub')
  on "$s" "bash /root/smg/ops/install.sh --type website --env prod --age-key '$pub' \
    --repo /root/smg.bundle --ref '$REF' --yes >/root/install.log 2>&1; status=\$?; tail -15 /root/install.log; exit \$status"
}

check() {
  local what=$1 got=$2 want=$3
  [[ $got == *"$want"* ]] || fail "$what: wanted \"$want\", got \"$got\""
  echo "PASS  $what"
}

website_checks() {
  local s=$1 mode=$2 route=$3 secret page signin status direct forged
  forged='-H X-Acting-User-Id:u-9 -H X-Acting-User:Mallory -H X-Acting-Guest:false -H X-Smg-Proxy-Secret:forged'
  check "the app answers through the website" "$(on "$s" "curl -s -o /dev/null -w '%{http_code}' $H $URL/")" 200
  check "the route file is private" "$(on "$s" "stat -c %a $route")" 600
  # shellcheck disable=SC2016 # expanded in the server
  secret=$(on "$s" '. /etc/smg/prod.env && printf %s "$SMG_WEBSITE_PROXY_SECRET"')
  check "the installer made a proxy secret" "${#secret}" 64
  check "... and did not print it" "$(on "$s" "grep -c '$secret' /root/install.log || true")" 0
  page='%2Fgames%2Fmini-games%2F%23%2Fmatch%2FABC123'
  signin=$(on "$s" "curl -s -o /dev/null -D - $H -b stub_user=u-1 -H X-Smg-Proxy-Secret:forged '$URL/auth/website?next=$page'")
  check "a website member is signed in with name, host right and steps" "$signin" 'smg_stub=u-1:Walter:true:steps'
  check "... and sent back to the page" "$signin" 'Location: /games/mini-games/#/match/ABC123'
  check "without a session the sign-in route ends at the website's login" \
    "$(on "$s" "curl -s -L -o /dev/null -w '%{url_effective}' $H '$URL/auth/website?next=$page'")" \
    '/login?next=%2Fgames%2Fmini-games%2Fauth%2Fwebsite%3Fnext%3D%252Fgames%252Fmini-games%252F%2523%252Fmatch%252FABC123'
  check "forged identity headers and secrets reach the app on no other route" \
    "$(on "$s" "curl -s $H $forged $URL/api/v1/session")" '{"headers": {}}'
  if [[ $mode == nginx ]]; then
    direct=$(on "$s" "curl -s -o /dev/null -w '%{http_code}' $forged http://127.0.0.1:3920/games/mini-games/auth/website")
    check "the app's port and subnet are not Bingo's (3900, 172.30.249.0/24)" \
      "$(on "$s" "docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' smg-prod_edge")" 172.30.250.0/24
  else
    direct=$(on "$s" "docker exec seasonal-site-caddy-1 wget -q -S -O /dev/null --header X-Acting-User-Id:u-1 \
      --header X-Acting-User:Walter http://smg-mini-games-prod:3100/games/mini-games/auth/website 2>&1 || true")
  fi
  check "forged headers sent to the app past the proxy sign nobody in" "$direct" 403
  check "metrics stay inside" "$(on "$s" "curl -s -o /dev/null -w '%{http_code}' $H $URL/metrics")" 404
  # smg status counts running rounds: the stand-in app made no schema, so a minimal one.
  on "$s" "docker exec smg-prod-postgres-1 psql -q -U smg -d smg -c 'CREATE SCHEMA IF NOT EXISTS smg; CREATE TABLE IF NOT EXISTS smg.rounds (status text)'"
  status=$(on "$s" 'smg status 2>&1')
  check "smg status names the sign-in mode" "$status" "sign-in:     website (the website's $mode)"
  check "smg status: the authorize endpoint answers" "$status" "authorize:   the website's endpoint answers (204)"
  check "smg status: the feed's last success" "$status" 'feed:        last success 20'
}

# website_case <mode> [off-first]: the whole case on a server of its own.
website_case() {
  local mode=$1 off_first=${2:-} s=smg-itest-$1 route out
  step "website ($mode): fresh server with Docker and the stand-in website"
  website_server "$s" "$mode"
  if [[ $off_first == off-first ]]; then
    step "website ($mode): Mini Games still switched off on the website"
    if out=$(install_website "$s"); then fail "the installer went on although the website answers 404"; fi
    check "the installer stops with the website's command" "$out" 'sudo ./deploy/install.sh --update --mini-games'
    check "... naming the checkout" "$out" 'cd /root/website &&'
    check "... and wrote nothing" "$(on "$s" 'ls /etc/smg 2>&1 || true')" 'No such file'
  fi
  switch_mini_games_on "$s"
  step "website ($mode): ops/install.sh --type website"
  install_website "$s"
  if [[ $mode == nginx ]]; then route=/etc/seasonal/routes/mini-games.conf; else route=$SITE/routes/mini-games.caddy; fi
  # The app's poller (the stand-in's) needs a moment for its first feed request.
  sleep 3
  website_checks "$s" "$mode" "$route"
  step "website ($mode): a re-run keeps every answer and changes nothing"
  check "the re-run changes nothing" "$(on "$s" 'bash /root/smg/ops/install.sh --yes 2>&1')" 'Done (0 change(s))'
}
