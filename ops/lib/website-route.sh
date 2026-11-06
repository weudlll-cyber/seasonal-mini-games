#!/usr/bin/env bash
# @file   ops/lib/website-route.sh
# @module ops
# @brief  Website installs: the game's own route file in the website's proxy, its check and reload, and the end-of-install check.
#
# Responsibility: write the game's route file into the folder the website's proxy already
#                 includes (nginx: /etc/seasonal/routes/mini-games.conf; Caddy: mini-games.caddy
#                 in the website's routes folder), 0600 because it holds the proxy secret, and
#                 never any website file. Its content (adopted from Bingo's write_nginx_route /
#                 write_caddy_route): /games/mini-games/ (HTTP and WebSocket) to the app;
#                 client-sent identity headers and X-Smg-Proxy-Secret cleared on every path; the
#                 sign-in route <base>auth/website asks the website's authorize endpoint
#                 (auth_request / forward_auth, with X-Original-Method, which the website needs and
#                 refuses without, fail closed), passes the seven identity headers and only then
#                 adds the secret (so the website never sees it); a refusal (401/403) goes to
#                 <base>auth/website/login with the same query; /games/mini-games/metrics 404.
#                 Then the proxy's own check (nginx -t, caddy validate): a failure puts the
#                 earlier file back and stops; else a reload. At the end, through the website on
#                 this server: /games/mini-games/ answers, the sign-in route without a session
#                 ends at the website's /login?next=…, and /embed/chat?room=mini-games answers.
# Depends on:     ./common.sh (put_file, run, info, warn, die, env_value, cleanup_path),
#                 ./website.sh (AUTHORIZE_PATH, website_caddy), curl, docker, nginx
# Used by:        ops/install.sh
# Spec:           docs/spec/10-repository-structure.md §6; docs/spec/07-integration.md §2; Bingo ops/lib/website.sh

BASE=/games/mini-games
# The only route that gets the identity headers and the secret (O66, as Bingo D37).
SIGN_IN_ROUTE=$BASE/auth/website
SECRET_HEADER=X-Smg-Proxy-Secret
# The website's identity headers (its docs/AUTH.md), the defaults the app reads.
IDENTITY_HEADERS=(X-Acting-User-Id X-Acting-User X-Acting-User-Roles X-Acting-User-Email-Verified
  X-Acting-User-Can-Host X-Acting-User-Steps X-Acting-Guest)

# The header name as nginx names a response header in a variable: lower case, "-" → "_".
nginx_var() { printf '%s' "$1" | tr 'A-Z-' 'a-z_'; }

# The proxy secret from the env file (a dry run has written none and shows no route text).
proxy_secret() {
  local secret
  secret=$(env_value "$SMG_ETC/$1.env" SMG_WEBSITE_PROXY_SECRET)
  printf '%s' "${secret:-unset-in-a-dry-run}"
}

write_nginx_route() {
  local env=$1 secret h var clear="    proxy_set_header $SECRET_HEADER \"\";"$'\n' set=''
  secret=$(proxy_secret "$env")
  for h in "${IDENTITY_HEADERS[@]}"; do
    var=smg_$(nginx_var "$h")
    clear+="    proxy_set_header $h \"\";"$'\n'
    set+="    auth_request_set \$$var \$upstream_http_$(nginx_var "$h");"$'\n'
    set+="    proxy_set_header $h \$$var;"$'\n'
  done
  cat <<EOF
# Seasonal Mini Games under $BASE (written by ops/install.sh, environment $env; do not edit,
# run the installer again). The website's server block includes this folder. Only
# $SIGN_IN_ROUTE asks the website who the visitor is and sends the app the proxy
# secret (this file is 0600); every other path clears client-sent identity headers.
location = $BASE { return 308 $BASE/; }
location ^~ $BASE/metrics { return 404; }
location ^~ $BASE/ {
${clear}    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    # HTTP and the WebSocket upgrade; the app keeps the $BASE prefix (SMG_BASE_PATH).
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$http_connection;
    proxy_pass http://127.0.0.1:$SMG_APP_PORT;
}
location = $SIGN_IN_ROUTE {
    auth_request /_smg_mini_games_authorize;
${set}    # After the authorize call, which never carries it.
    proxy_set_header $SECRET_HEADER "$secret";
    error_page 401 403 = @smg_mini_games_login;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_pass http://127.0.0.1:$SMG_APP_PORT;
}
location = /_smg_mini_games_authorize {
    internal;
    proxy_pass http://$SMG_WEBSITE_UPSTREAM$AUTHORIZE_PATH;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header $SECRET_HEADER "";
    proxy_set_header Host \$host;
    # The website refuses (403) a request without the browser's method (fail closed).
    proxy_set_header X-Original-Method \$request_method;
    proxy_set_header X-Original-URI \$request_uri;
}
# A visitor the website refused: the app sends on to the website's login with the page.
location @smg_mini_games_login { return 302 $SIGN_IN_ROUTE/login\$is_args\$args; }
EOF
}

write_caddy_route() {
  local env=$1 secret h clear=''
  secret=$(proxy_secret "$env")
  for h in "${IDENTITY_HEADERS[@]}" "$SECRET_HEADER"; do clear+=$'\t\t'"request_header -$h"$'\n'; done
  cat <<EOF
# Seasonal Mini Games under $BASE (written by ops/install.sh, environment $env; do not edit,
# run the installer again). Imported inside the website's site block; "handle $BASE/*"
# runs before the site's catch-all. Only $SIGN_IN_ROUTE asks the website who the
# visitor is and sends the app the proxy secret (this file is 0600).
redir $BASE $BASE/ 308
handle $BASE/* {
	# In this order (Caddy's own order would run forward_auth before request_header).
	route {
		# Metrics stay inside the server (the app refuses proxied requests to them as well).
		@smg_metrics path $BASE/metrics $BASE/metrics/*
		respond @smg_metrics 404
		# Client-sent identity headers and proxy secrets never reach the app (nor the website).
$clear		@smg_signin path $SIGN_IN_ROUTE
		forward_auth @smg_signin $SMG_WEBSITE_UPSTREAM {
			uri $AUTHORIZE_PATH
			# The website refuses (403) a request without the browser's method (fail closed);
			# forward_auth sends it only as X-Forwarded-Method.
			header_up X-Original-Method {http.request.method}
			header_up X-Original-URI {http.request.uri}
			copy_headers ${IDENTITY_HEADERS[*]}
			# A visitor the website refused: the app sends on to its login with the page.
			@smg_refused status 401 403
			handle_response @smg_refused {
				redir * $SIGN_IN_ROUTE/login?{query} 302
			}
		}
		# After forward_auth, so the website never sees it.
		request_header @smg_signin $SECRET_HEADER $secret
		# HTTP and the WebSocket upgrade; the app keeps the $BASE prefix (SMG_BASE_PATH).
		reverse_proxy smg-mini-games-$env:3100
	}
}
EOF
}

# The website's proxy checks its whole configuration with the route file in it.
proxy_check() {
  if [[ $SMG_WEBSITE_MODE == nginx ]]; then
    nginx -t -q
  else
    docker exec "$(website_caddy)" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  fi
}

proxy_reload() {
  if [[ $SMG_WEBSITE_MODE == nginx ]]; then
    systemctl reload nginx
  else
    docker exec "$(website_caddy)" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  fi
}

# install_route <env>: writes the route file, checks the proxy (a failure puts the earlier
# file back, or removes the new one, and stops) and reloads it.
install_route() {
  local env=$1 file=$SMG_WEBSITE_ROUTE_FILE old
  old=$(mktemp)
  cleanup_path "$old"
  [[ ! -f $file ]] || cp -p "$file" "$old"
  if [[ $SMG_WEBSITE_MODE == nginx ]]; then
    write_nginx_route "$env" | put_file "$file" 0600
  else
    write_caddy_route "$env" | put_file "$file" 0600
  fi
  if ! run proxy_check; then
    if [[ -s $old ]]; then cp -p "$old" "$file"; else rm -f "$file"; fi
    die "the website's $SMG_WEBSITE_MODE refused the route file (see above); the earlier state is back, nothing was reloaded"
  fi
  run proxy_reload
  # A dry run only printed the reload above; it must not claim it happened.
  if [[ $SMG_DRY_RUN == 1 ]]; then
    info "  route: $file, the website's $SMG_WEBSITE_MODE would be reloaded"
  else
    info "  route: $file, the website's $SMG_WEBSITE_MODE reloaded"
  fi
}

# site_fetch <path> [curl args…]: "<status> <last URL>" of one request to the website through
# its proxy on this server: https first, plain http when nothing answers there.
site_fetch() {
  local path=$1 domain=$SMG_WEBSITE_DOMAIN out
  shift
  out=$(curl -s -o /dev/null -m 10 --resolve "$domain:443:127.0.0.1" -w '%{http_code} %{url_effective}' "$@" "https://$domain$path" || true)
  [[ $out != 000* ]] ||
    out=$(curl -s -o /dev/null -m 10 --resolve "$domain:80:127.0.0.1" -w '%{http_code} %{url_effective}' "$@" "http://$domain$path" || true)
  printf '%s' "$out"
}

# verify_website: the end-of-install check through the website; stops naming what failed.
verify_website() {
  local failed=() got
  [[ $SMG_DRY_RUN != 1 ]] || { info "  would check $BASE/, the sign-in route and /embed/chat through the website"; return 0; }
  info "Checking through the website (https://$SMG_WEBSITE_DOMAIN)"
  got=$(site_fetch "$BASE/")
  if [[ $got == 200* ]]; then info "  ok: $BASE/ answers"; else failed+=("$BASE/ answered ${got%% *}"); fi
  # Without a session the website answers as for a guest; the app sends to its login.
  got=$(site_fetch "$SIGN_IN_ROUTE?next=%2Fgames%2Fmini-games%2F" -L --max-redirs 5)
  if [[ ${got#* } == *"${SMG_WEBSITE_LOGIN_PATH%%\?*}?"* ]]; then
    info "  ok: the sign-in route reaches the website's authorize endpoint and its login"
  else
    failed+=("the sign-in route ended at ${got#* } (status ${got%% *}), not at the website's ${SMG_WEBSITE_LOGIN_PATH}…")
  fi
  got=$(site_fetch '/embed/chat?room=mini-games')
  if [[ $got == 2* ]]; then info "  ok: the website's chat room mini-games answers"; else failed+=("/embed/chat?room=mini-games answered ${got%% *}"); fi
  ((${#failed[@]} == 0)) || die "installed, but the check through the website failed: $(printf '%s; ' "${failed[@]}")see sudo smg status and sudo smg logs app"
}
