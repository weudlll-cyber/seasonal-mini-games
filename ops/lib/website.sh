#!/usr/bin/env bash
# @file   ops/lib/website.sh
# @module ops
# @brief  Website installs: find the running Seasonal Entertainment website, write the Caddy snippet.
#
# Responsibility: find the website's Caddy (compose project "seasonal-site", service
#                 "caddy", as its docs/DEPLOYMENT.md sets it up in deploy/site/) and from it
#                 the Docker network (seasonal-site_default, else its only one, else asked),
#                 that network's subnet as the trusted proxy range and the website's domain
#                 (SITE_DOMAIN); stop with a plain message when the website is not running
#                 (a dry run on a server without Docker yet only shows the step).
#                 Write the snippet that routes /games/mini-games/* (HTTP and WebSocket) to the
#                 app and print how to add it to the website's Caddyfile. The installer never
#                 edits the website's files.
# Used by:        ops/install.sh, ops/smg (status)
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §1, §8

WEBSITE_PROJECT=seasonal-site

website_caddy() {
  command -v docker >/dev/null || return 0
  docker ps --filter "label=com.docker.compose.project=$WEBSITE_PROJECT" \
    --filter label=com.docker.compose.service=caddy --format '{{.Names}}' | head -1
}

network_subnet() { docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}' "$1" | awk '{ print $1 }'; }

# choose_network <caddy>: the compose default network of the website when Caddy is on it,
# else its only network; with several, ask (or --website-network in unattended runs).
choose_network() {
  local caddy=$1 networks
  networks=$(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' "$caddy")
  if [[ -n ${SMG_WEBSITE_NETWORK:-} ]]; then
    [[ " $networks " == *" $SMG_WEBSITE_NETWORK "* ]] || die "the website's Caddy is not on the network $SMG_WEBSITE_NETWORK (it is on: $networks)"
  elif [[ " $networks " == *" ${WEBSITE_PROJECT}_default "* ]]; then
    SMG_WEBSITE_NETWORK=${WEBSITE_PROJECT}_default
  elif [[ $(wc -w <<<"$networks") -eq 1 ]]; then
    SMG_WEBSITE_NETWORK=${networks// /}
  else
    ask SMG_WEBSITE_NETWORK "The website's Caddy is on several networks ($networks): which one should mini games join?"
  fi
}

# detect_website: sets SMG_WEBSITE_NETWORK, SMG_TRUSTED_PROXIES and (unless given)
# SMG_WEBSITE_DOMAIN, or stops.
detect_website() {
  local caddy
  # A dry run on a server without Docker yet cannot look; it shows the step instead.
  if [[ $SMG_DRY_RUN == 1 ]] && ! command -v docker >/dev/null; then
    info "  would look for the website's Caddy (compose project $WEBSITE_PROJECT) once Docker is installed"
    SMG_WEBSITE_NETWORK=${SMG_WEBSITE_NETWORK:-${WEBSITE_PROJECT}_default}
    SMG_TRUSTED_PROXIES='<the website network range>'
    SMG_WEBSITE_DOMAIN=${SMG_WEBSITE_DOMAIN:-<the website domain>}
    return 0
  fi
  caddy=$(website_caddy)
  if [[ -z $caddy ]]; then
    die "the Seasonal Entertainment website is not running on this server (no Caddy container of the compose project \"$WEBSITE_PROJECT\"). Install the website first (its docs/DEPLOYMENT.md), then run this installer again with --type website."
  fi
  choose_network "$caddy"
  # The whole network's range: Caddy keeps working for the app after it is recreated.
  SMG_TRUSTED_PROXIES=$(network_subnet "$SMG_WEBSITE_NETWORK")
  if [[ -z ${SMG_WEBSITE_DOMAIN:-} ]]; then
    SMG_WEBSITE_DOMAIN=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$caddy" | sed -n 's/^SITE_DOMAIN=//p')
  fi
  ask SMG_WEBSITE_DOMAIN "The website's domain (e.g. example.org)"
  info "  website: Caddy $caddy on network $SMG_WEBSITE_NETWORK ($SMG_TRUSTED_PROXIES), domain $SMG_WEBSITE_DOMAIN"
}

# write_snippet <env>: the route for the website's Caddyfile (snippet_steps says how to add it).
write_snippet() {
  local env=$1 target="$SMG_ROOT/website-mini-games.caddy"
  put_file "$target" 0644 <<EOF
# Seasonal Mini Games under /games/mini-games (written by ops/install.sh, environment $env).
# Belongs inside the website's {\$SITE_DOMAIN} block: before its catch-all reverse_proxy,
# Caddy runs "handle" first, so these paths go to the mini games app, the rest to the site.
redir /games/mini-games /games/mini-games/ 308
# Metrics stay inside the server (the app refuses proxied requests to them as well).
@smg_metrics path /games/mini-games/metrics /games/mini-games/metrics/*
respond @smg_metrics 404
handle /games/mini-games/* {
	# HTTP and the WebSocket upgrade; the app keeps the /games/mini-games prefix (SMG_BASE_PATH).
	reverse_proxy smg-mini-games-$env:3100
}
EOF
}

# snippet_steps: how to add the snippet to the website's Caddy (printed at the end).
snippet_steps() {
  local target="$SMG_ROOT/website-mini-games.caddy"
  cat <<EOF
Add mini games to the website's Caddy (once, on this server):
     a. In the website checkout, create deploy/site/routes/ and copy $target into it as mini-games.caddy.
     b. In deploy/site/Caddyfile, inside the {\$SITE_DOMAIN} { … } block, add the line:
          import /etc/caddy/routes/*.caddy
     c. In deploy/site/docker-compose.yml, give the caddy service the volume:
          - ./routes:/etc/caddy/routes:ro
     d. Apply it:  cd <website checkout>/deploy/site && docker compose up -d caddy
        (a later change to mini-games.caddy only needs:  docker exec $(website_caddy) caddy reload --config /etc/caddy/Caddyfile)
     Then open https://$SMG_WEBSITE_DOMAIN/games/mini-games/
EOF
}
