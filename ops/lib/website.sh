#!/usr/bin/env bash
# @file   ops/lib/website.sh
# @module ops
# @brief  Website installs: find the running Seasonal Entertainment website, its mode and what it prepared for Mini Games.
#
# Responsibility: detect the website's mode as its own installer sets it up (its
#                 docs/DEPLOYMENT.md): own Caddy (the Caddy container of compose project
#                 "seasonal-site") or host nginx on 80/443 in front of the site container
#                 (same project); stop with a plain message when neither runs. From what the
#                 website prepared, with no question: the routes folder (nginx:
#                 /etc/seasonal/routes/; Caddy: the host folder mounted at /etc/caddy/routes in
#                 its Caddy container), the site's local port (/etc/seasonal/site-local-port,
#                 nginx), the games' sync token (/etc/seasonal/games-sync-token), the domain
#                 (the site's PUBLIC_ORIGIN, else Caddy's SITE_DOMAIN, else asked) and the
#                 website's Docker network (the app joins it to read the account feed at
#                 http://site:3800; asked only when ambiguous). Probe the website's
#                 /api/games/mini-games/authorize from this server: a 404 (Mini Games switched
#                 off there) or a missing token stops with the website's own command
#                 (--mini-games). The trusted proxy ranges per mode: Caddy, the website
#                 network's subnets; nginx, the app's fixed edge subnet and the website network
#                 (Docker's port proxy connects from the gateway of either). For smg status:
#                 the sign-in mode, the authorize endpoint's answer, the feed's last success,
#                 and whether the trusted ranges still match.
# Depends on:     ./common.sh (info, warn, die, ask, env_value, compose), docker, curl, ss
# Used by:        ops/install.sh, ops/lib/website-route.sh, ops/smg (status)
# Spec:           docs/spec/10-repository-structure.md §6; docs/spec/07-integration.md §2; Bingo ops/lib/website.sh

WEBSITE_PROJECT=seasonal-site
SEASONAL_ETC=/etc/seasonal
# The website's endpoint that tells the game's proxy who the visitor is (O66, as Bingo D37).
AUTHORIZE_PATH=/api/games/mini-games/authorize
# The site container on the website's network, in both modes (its compose service and port).
SITE_UPSTREAM=site:3800

# website_container <service>: the running container of that service of the website's project.
website_container() {
  command -v docker >/dev/null || return 0
  docker ps --filter "label=com.docker.compose.project=$WEBSITE_PROJECT" \
    --filter "label=com.docker.compose.service=$1" --format '{{.Names}}' | head -1
}
website_caddy() { website_container caddy; }

# The website runs behind host nginx: an nginx process listens on 80 or 443.
website_nginx() {
  command -v ss >/dev/null || return 1
  ss -ltnpH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -q '"nginx"'
}

# network_subnets <network>: every IPAM subnet of it, comma-separated as SMG_TRUSTED_PROXIES takes them.
network_subnets() {
  docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}' "$1" | xargs | tr ' ' ','
}

# choose_network <container>: the website project's default network when the container is
# on it, else its only network; with several, ask (or --website-network in unattended runs).
choose_network() {
  local container=$1 networks
  networks=$(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' "$container")
  if [[ -n ${SMG_WEBSITE_NETWORK:-} ]]; then
    [[ " $networks " == *" $SMG_WEBSITE_NETWORK "* ]] || die "the website's $container is not on the network $SMG_WEBSITE_NETWORK (it is on: $networks)"
  elif [[ " $networks " == *" ${WEBSITE_PROJECT}_default "* ]]; then
    SMG_WEBSITE_NETWORK=${WEBSITE_PROJECT}_default
  elif [[ $(wc -w <<<"$networks") -eq 1 ]]; then
    SMG_WEBSITE_NETWORK=${networks// /}
  else
    ask SMG_WEBSITE_NETWORK "The website's $container is on several networks ($networks): which one should mini games join?"
  fi
}

# The website's checkout, for messages: the compose working folder is <checkout>/deploy/site.
website_checkout() {
  local dir
  dir=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$1" 2>/dev/null || true)
  printf '%s' "${dir%/deploy/site}"
}

# What to run in the website's checkout when it does not serve Mini Games yet.
mini_games_command() {
  printf 'cd %s && sudo ./deploy/install.sh --update --mini-games' "${SMG_WEBSITE_CHECKOUT:-<website checkout>}"
}

# The host folder the website's Caddy imports routes from (its mount at /etc/caddy/routes).
caddy_routes_dir() {
  docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/routes"}}{{.Source}}{{end}}{{end}}' "$1"
}

# The website's own Caddy: routes folder, network and its ranges, the site's address.
detect_caddy_mode() {
  local caddy=$1 dir
  SMG_WEBSITE_MODE=caddy
  dir=$(caddy_routes_dir "$caddy")
  [[ -n $dir ]] || die "the website's Caddy imports no routes folder (/etc/caddy/routes). Update the website first: $(mini_games_command)"
  SMG_WEBSITE_ROUTE_FILE=$dir/mini-games.caddy
  choose_network "$caddy"
  # The whole network's ranges: Caddy keeps working for the app after it is recreated.
  SMG_TRUSTED_PROXIES=$(network_subnets "$SMG_WEBSITE_NETWORK")
  [[ -n $SMG_TRUSTED_PROXIES ]] || die "the network $SMG_WEBSITE_NETWORK has no subnet to trust (docker network inspect $SMG_WEBSITE_NETWORK)"
  SMG_WEBSITE_UPSTREAM=$SITE_UPSTREAM
  [[ -n ${SMG_WEBSITE_DOMAIN:-} ]] ||
    SMG_WEBSITE_DOMAIN=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$caddy" | sed -n 's/^SITE_DOMAIN=//p')
}

# Host nginx in front of the site container: routes folder, local port, the app's own port.
detect_nginx_mode() {
  local site=$1 port
  SMG_WEBSITE_MODE=nginx
  [[ -d $SEASONAL_ETC/routes ]] || die "the website's nginx has no routes folder ($SEASONAL_ETC/routes). Update the website first: $(mini_games_command)"
  port=$(tr -d '[:space:]' <"$SEASONAL_ETC/site-local-port" 2>/dev/null || true)
  [[ $port =~ ^[0-9]+$ ]] || die "the website wrote no local port ($SEASONAL_ETC/site-local-port). Update the website first: $(mini_games_command)"
  SMG_WEBSITE_ROUTE_FILE=$SEASONAL_ETC/routes/mini-games.conf
  SMG_WEBSITE_UPSTREAM=127.0.0.1:$port
  # Distinct from Bingo's 3900 and 172.30.249.0/24, so both run beside each other.
  SMG_APP_PORT=${SMG_APP_PORT:-3920}
  SMG_EDGE_SUBNET=${SMG_EDGE_SUBNET:-172.30.250.0/24}
  choose_network "$site"
  SMG_TRUSTED_PROXIES=$SMG_EDGE_SUBNET,$(network_subnets "$SMG_WEBSITE_NETWORK")
}

# authorize_status [mode] [upstream]: the HTTP status of the website's authorize endpoint for
# a visitor without a session (the website answers 204), or "no answer". Caddy mode asks from
# inside the website's Caddy, which is on the site's network.
authorize_status() {
  local mode=${1:-$SMG_WEBSITE_MODE} upstream=${2:-$SMG_WEBSITE_UPSTREAM} code='' caddy
  if [[ $mode == nginx ]]; then
    code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' -H 'X-Original-Method: GET' "http://$upstream$AUTHORIZE_PATH" || true)
  else
    caddy=$(website_caddy)
    [[ -z $caddy ]] || code=$(docker exec "$caddy" wget -S -q -O /dev/null -T 5 --header 'X-Original-Method: GET' \
      "http://$upstream$AUTHORIZE_PATH" 2>&1 | awk '/HTTP\//{print $2; exit}' || true)
  fi
  if [[ -n $code && $code != 000 ]]; then printf '%s' "$code"; else printf 'no answer'; fi
}

# The website must serve Mini Games: its authorize endpoint answers 2xx and the token is there.
require_mini_games() {
  local code
  code=$(authorize_status)
  if [[ $code == 404 ]]; then
    die "the website does not serve Mini Games yet ($AUTHORIZE_PATH answers 404). Switch it on with the website's own installer, then run this installer again: $(mini_games_command)"
  fi
  [[ $code == 2* ]] || die "the website's $AUTHORIZE_PATH on $SMG_WEBSITE_UPSTREAM answered $code (2xx expected); check the website (its --status)"
  [[ -s $SEASONAL_ETC/games-sync-token ]] || die "the website made no games sync token ($SEASONAL_ETC/games-sync-token). Switch Mini Games on there, then run this installer again: $(mini_games_command)"
  SMG_WEBSITE_SYNC_TOKEN=$(tr -d '[:space:]' <"$SEASONAL_ETC/games-sync-token")
}

# A dry run on a server without Docker yet cannot look; it shows the step instead.
# The answers go to write_env (lib/config.sh), which reads them by name.
# shellcheck disable=SC2034
dry_run_website() {
  info "  would detect the website's mode (its Caddy of compose project $WEBSITE_PROJECT, or host nginx on 80/443) once Docker is installed"
  SMG_WEBSITE_MODE=${SMG_WEBSITE_MODE:-caddy}
  SMG_WEBSITE_NETWORK=${SMG_WEBSITE_NETWORK:-${WEBSITE_PROJECT}_default}
  SMG_WEBSITE_ROUTE_FILE='<the website routes folder>/mini-games.caddy'
  SMG_WEBSITE_UPSTREAM=$SITE_UPSTREAM SMG_WEBSITE_SYNC_TOKEN='<from the website>'
  SMG_TRUSTED_PROXIES='<the website network range>'
  SMG_WEBSITE_DOMAIN=${SMG_WEBSITE_DOMAIN:-<the website domain>}
  SMG_WEBSITE_LOGIN_PATH=${SMG_WEBSITE_LOGIN_PATH:-/login?next=}
}

# detect_website: sets the SMG_WEBSITE_* answers and SMG_TRUSTED_PROXIES, or stops.
# shellcheck disable=SC2034 # read by write_env (lib/config.sh) by name
detect_website() {
  local caddy site
  if [[ $SMG_DRY_RUN == 1 ]] && ! command -v docker >/dev/null; then dry_run_website; return 0; fi
  caddy=$(website_caddy)
  site=$(website_container site)
  if [[ -n $caddy || -n $site ]]; then SMG_WEBSITE_CHECKOUT=$(website_checkout "${caddy:-$site}"); fi
  if [[ -n $caddy ]]; then
    detect_caddy_mode "$caddy"
  elif website_nginx && [[ -n $site ]]; then
    detect_nginx_mode "$site"
  else
    die "the Seasonal Entertainment website is not running on this server (no Caddy container of the compose project \"$WEBSITE_PROJECT\", and no nginx on ports 80/443 in front of its site container). Install the website first with Mini Games switched on (its docs/DEPLOYMENT.md: sudo ./deploy/install.sh --mini-games), then run this installer again."
  fi
  require_mini_games
  SMG_WEBSITE_LOCAL_URL=http://$SITE_UPSTREAM
  SMG_WEBSITE_LOGIN_PATH=${SMG_WEBSITE_LOGIN_PATH:-/login?next=}
  # The site's own public address names the domain (in both modes).
  [[ -z $site || -n ${SMG_WEBSITE_DOMAIN:-} ]] ||
    SMG_WEBSITE_DOMAIN=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$site" | sed -n 's|^PUBLIC_ORIGIN=https\?://||p')
  ask SMG_WEBSITE_DOMAIN "The website's domain (e.g. example.org)"
  info "  website: $SMG_WEBSITE_MODE mode, domain $SMG_WEBSITE_DOMAIN, Mini Games switched on; the app trusts $SMG_TRUSTED_PROXIES"
}

# The poller's last success as the app reports it. Until the server's report fixes the
# field, read GET <base>readyz's websiteFeed.lastSuccessAt; "unknown" without one.
feed_last_success() {
  local body at
  body=$(compose "$1" exec -T app wget -qO- http://127.0.0.1:3100/readyz 2>/dev/null || true)
  at=$(sed -n 's/.*"websiteFeed": *{[^}]*"lastSuccessAt": *"\{0,1\}\([^", }]*\).*/\1/p' <<<"$body")
  [[ $at != null ]] || at='none yet'
  printf '%s' "${at:-unknown}"
}

# website_status <env>: smg status's lines on the sign-in, the website and the proxy.
website_status() {
  local file="$SMG_ETC/$1.env" mode code network now trusted
  mode=$(env_value "$file" SMG_WEBSITE_MODE)
  info "sign-in:     $(env_value "$file" SMG_AUTH_MODE) (the website's $mode)"
  code=$(authorize_status "$mode" "$(env_value "$file" SMG_WEBSITE_UPSTREAM)")
  if [[ $code == 2* ]]; then
    info "authorize:   the website's endpoint answers ($code)"
  else
    warn "the website's authorize endpoint answered $code: nobody can sign in (website: --status)"
  fi
  info "feed:        last success $(feed_last_success "$1")"
  network=$(env_value "$file" SMG_WEBSITE_NETWORK)
  now=$(network_subnets "$network" 2>/dev/null || true)
  [[ $mode == caddy ]] || now=$(env_value "$file" SMG_EDGE_SUBNET),$now
  trusted=$(env_value "$file" SMG_TRUSTED_PROXIES)
  if [[ $now == "$trusted" ]]; then
    info "proxy:       the website's $mode, trusted $trusted"
  else
    warn "the website's network is now $now, the app trusts $trusted: run the installer again to update it"
  fi
}
