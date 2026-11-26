#!/usr/bin/env bash
# @file   ops/lib/config.sh
# @module ops
# @brief  The install's files: env file with secrets, install record, stack files, the app image.
#
# Responsibility: read the answers of an earlier run back from /etc/smg/<env>.env, so a
#                 re-run (also with --yes) keeps them; write that file (0600, values
#                 single-quoted for Compose, written atomically) — secrets made once with
#                 openssl rand and kept on every later run, the public URL, base path and
#                 trusted proxy for the install type, the database's three passwords (the
#                 superuser's, and the owner and app roles', kit K90; DATABASE_URL is the app
#                 role's), admin e-mail, the operator's age key
#                 (the round key SMG_ROUND_KEY seals round seeds at rest, 05 §3: made once,
#                 never changed, or running rounds could not be recovered; the recovery key
#                 SMG_RECOVERY_KEY keys the two-factor recovery codes, a secret of its own,
#                 made once the same way, so an install made before it gains it on its next run); the sign-in mode
#                 (SMG_AUTH_MODE: local standalone, website inside the website, O66) and for
#                 website installs the website's settings (lib/website.sh), the proxy secret
#                 (made once, kept) and the chat provider hostEmbed; write the install
#                 record /etc/smg/install.conf; copy the compose files, Caddyfile, the smg CLI and its
#                 library and the kit's whole ops folder (from the built image) to /opt/smg; set up
#                 the two database roles (the kit's db-roles script, on install, for the
#                 one-time conversion of an older install, on an update and after a restore);
#                 build the app image on the server from a git ref (until a signed release
#                 image exists; by default the installer checkout's own branch, checkout_ref),
#                 skipping it when the image of that commit is there.
# Depends on:     ./common.sh (put_file, run, env_value, set_env_value, compose), git, docker,
#                 openssl
# Used by:        ops/install.sh, ops/smg
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §2, §3

# secret <bytes>: hex from openssl rand (a dry run, which installs nothing, may lack it).
secret() {
  if command -v openssl >/dev/null; then
    openssl rand -hex "$1"
  else
    od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'
  fi
}

# Answers of an earlier run, unless a flag gave a new one (Bingo audit O4).
read_saved_answers() {
  local file="$SMG_ETC/$1.env" key
  for key in SMG_ADMIN_EMAIL SMG_AGE_RECIPIENT SMG_WEBSITE_NETWORK SMG_WEBSITE_LOGIN_PATH     SMG_APP_PORT SMG_EDGE_SUBNET; do
    [[ -n ${!key:-} ]] || printf -v "$key" '%s' "$(env_value "$file" "$key")"
  done
}

# KEY='value' — Compose then takes the value literally; a single quote cannot be written so.
quoted() {
  [[ $2 != *"'"* ]] || die "$1 must not contain a single quote (')"
  printf "%s='%s'\n" "$1" "$2"
}

# The website's settings of a website install (lib/website.sh), only the ones with a value:
# the app refuses an empty URL or login path. The proxy secret is made once and kept.
# shellcheck disable=SC2034 # the keys are read by name
website_env() {
  local file=$1 key
  SMG_WEBSITE_PROXY_SECRET=$(env_value "$file" SMG_WEBSITE_PROXY_SECRET)
  [[ -n $SMG_WEBSITE_PROXY_SECRET ]] || SMG_WEBSITE_PROXY_SECRET=$(secret 32)
  # In the website the chat is the website's own room mini-games (07 §2); admins may change it.
  SMG_CHAT_PROVIDER=hostEmbed
  for key in SMG_WEBSITE_MODE SMG_WEBSITE_UPSTREAM SMG_WEBSITE_ROUTE_FILE SMG_WEBSITE_LOCAL_URL     SMG_WEBSITE_LOGIN_PATH SMG_WEBSITE_SYNC_TOKEN SMG_WEBSITE_PROXY_SECRET SMG_APP_PORT     SMG_EDGE_SUBNET SMG_CHAT_PROVIDER; do
    [[ -z ${!key:-} ]] || quoted "$key" "${!key}"
  done
}

# write_env <env>: from the answers in SMG_* variables; secrets survive a re-run.
write_env() {
  local env=$1 file="$SMG_ETC/$1.env" pg owner app round recovery public base site tls key
  pg=$(env_value "$file" POSTGRES_PASSWORD)
  round=$(env_value "$file" SMG_ROUND_KEY)
  recovery=$(env_value "$file" SMG_RECOVERY_KEY)
  [[ -n $pg ]] || pg=$(secret 24)
  # An install made before the database roles gains them on its next run and keeps them after.
  owner=$(env_value "$file" SMG_DB_OWNER_PASSWORD)
  app=$(env_value "$file" SMG_DB_APP_PASSWORD)
  [[ -n $owner ]] || owner=$(secret 24)
  [[ -n $app ]] || app=$(secret 24)
  [[ -n $round ]] || round=$(secret 32)
  # An install made before the recovery key gains it on its next run and keeps it after.
  [[ -n $recovery ]] || recovery=$(secret 32)
  if [[ $SMG_TYPE == website ]]; then
    public="https://$SMG_WEBSITE_DOMAIN/games/mini-games/" base=/games/mini-games/ site='' tls=''
  else
    public="https://$SMG_ADDRESS/" base=/ site=$SMG_ADDRESS tls=''
    # An IP address gets Caddy's internal CA (browsers warn until a domain is set).
    [[ $SMG_ADDRESS =~ ^[0-9.]+$|: ]] && tls='tls internal'
    SMG_TRUSTED_PROXIES=uniquelocal
  fi
  {
    echo "# Seasonal Mini Games, environment $env (written by ops/install.sh; secrets are kept on re-runs)."
    quoted SMG_INSTALL_TYPE "$SMG_TYPE"
    quoted SMG_ENV "$env"
    quoted SMG_ENV_FILE "$file"
    quoted SMG_IMAGE "$SMG_IMAGE"
    quoted POSTGRES_PASSWORD "$pg"
    quoted SMG_DB_OWNER_PASSWORD "$owner"
    quoted SMG_DB_APP_PASSWORD "$app"
    quoted DATABASE_URL "postgres://smg_app:$app@postgres:5432/smg"
    quoted SMG_ROUND_KEY "$round"
    quoted SMG_RECOVERY_KEY "$recovery"
    quoted SMG_PUBLIC_URL "$public"
    quoted SMG_BASE_PATH "$base"
    quoted SMG_TRUSTED_PROXIES "$SMG_TRUSTED_PROXIES"
    quoted SMG_SITE_ADDRESS "$site"
    quoted SMG_TLS "$tls"
    for key in SMG_WEBSITE_NETWORK SMG_ADMIN_EMAIL SMG_AGE_RECIPIENT; do
      quoted "$key" "${!key:-}"
    done
    quoted SMG_LOG_LEVEL info
    # O66, as Bingo D37: inside the website players sign in only through its login.
    if [[ $SMG_TYPE == website ]]; then
      quoted SMG_AUTH_MODE website
      website_env "$file"
    else
      quoted SMG_AUTH_MODE local
    fi
  } | put_file "$file" 0600
}

write_record() {
  put_file "$SMG_ETC/install.conf" 0600 <<EOF
# What ops/install.sh installed last; re-runs and smg read it.
SMG_TYPE=$SMG_TYPE
SMG_ENV=$SMG_ENV
SMG_ADDRESS=${SMG_ADDRESS:-}
SMG_WEBSITE_DOMAIN=${SMG_WEBSITE_DOMAIN:-}
SMG_REPO=$SMG_REPO
SMG_REF=$SMG_REF
EOF
}

# install_files <source dir of ops/>: the stack files, the CLI and the kit's scripts into
# /opt/smg.
install_files() {
  local from=$1 name
  for name in compose.yml compose.website.yml compose.website-nginx.yml; do
    put_file "$SMG_ROOT/$name" 0644 <"$from/$name"
  done
  put_file "$SMG_ROOT/caddy/Caddyfile" 0644 <"$from/Caddyfile"
  for name in common.sh host.sh website.sh config.sh backup.sh; do
    put_file "$SMG_ROOT/lib/$name" 0644 <"$from/lib/$name"
  done
  put_file "$SMG_ROOT/smg" 0755 <"$from/smg"
  [[ -L /usr/local/bin/smg ]] || run ln -sf "$SMG_ROOT/smg" /usr/local/bin/smg
  install_kit_ops "$SMG_IMAGE"
}

# install_kit_ops <image>: the kit's whole ops folder, its layout kept, into /opt/smg/kit/ops,
# from the image that was just built, so it is the pinned kit version's (T431, T436).
install_kit_ops() {
  local container from file name
  if [[ $SMG_DRY_RUN == 1 ]]; then
    info "  would copy the kit's ops folder from $1 into $SMG_ROOT/kit/ops"
    return 0
  fi
  from=$(mktemp -d)
  cleanup_path "$from"
  container=$(docker create "$1")
  cleanup_container "$container"
  docker cp "$container:/app/kit-ops/." "$from"
  while IFS= read -r -d '' file; do
    name=${file#"$from/"}
    # World-readable: an operator copies the pull script to their own computer from here.
    put_file "$SMG_ROOT/kit/ops/$name" 0755 <"$file"
  done < <(find "$from" -type f -print0)
}

# prepare_database <env>: the two roles' passwords and the app role's address in an env file
# that lacks them (an install from before the roles), then the roles themselves.
prepare_database() {
  local file="$SMG_ETC/$1.env" app
  if [[ -z $(env_value "$file" SMG_DB_APP_PASSWORD) ]]; then
    app=$(secret 24)
    set_env_value "$file" SMG_DB_OWNER_PASSWORD "$(secret 24)"
    set_env_value "$file" SMG_DB_APP_PASSWORD "$app"
    set_env_value "$file" DATABASE_URL "postgres://smg_app:$app@postgres:5432/smg"
  fi
  apply_db_roles "$1"
}

# apply_db_roles <env>: the owner and app database roles (kit K90), sent to the superuser's psql
# in the database container; the passwords go on standard input only. Then the one right more
# the owner needs: migration 0011 makes a temporary table, which the kit's script leaves to
# nobody (T436).
# shellcheck disable=SC2034 # the kit's script reads the SK_DB_* names
apply_db_roles() (
  file="$SMG_ETC/$1.env"
  # shellcheck source=/dev/null
  source "$SMG_ROOT/kit/ops/lib/db-roles.sh"
  SK_DB_PREFIX=smg
  SK_DB_OWNER_PASSWORD=$(env_value "$file" SMG_DB_OWNER_PASSWORD)
  SK_DB_APP_PASSWORD=$(env_value "$file" SMG_DB_APP_PASSWORD)
  psql=(compose "$1" exec -T postgres psql -X -q -v ON_ERROR_STOP=1 -U smg -d smg)
  sk_db_roles_apply "${psql[@]}" &&
    "${psql[@]}" -c 'GRANT TEMPORARY ON DATABASE smg TO smg_owner'
)

# checkout_ref <dir>: the branch the checkout holding <dir> is on, its commit when detached,
# nothing outside a checkout: the code the operator cloned is the code that gets built.
checkout_ref() {
  git -C "$1" symbolic-ref --quiet --short HEAD 2>/dev/null || git -C "$1" rev-parse --quiet --verify HEAD 2>/dev/null || true
}

# build_image <repo> <ref>: sets SMG_IMAGE=smg-app:<commit> and builds it when missing.
build_image() {
  local repo=$1 ref=$2 src="$SMG_ROOT/src" commit
  if [[ $SMG_DRY_RUN == 1 ]]; then
    # A dry run touches nothing, not even the checkout (Bingo audit O11).
    info "  would fetch $ref from $repo into $src and build smg-app:<commit>"
    SMG_IMAGE="smg-app:<commit of $ref>"
    return 0
  fi
  if [[ ! -d $src/.git ]]; then
    git clone --quiet "$repo" "$src"
  elif [[ $(git -C "$src" remote get-url origin) != "$repo" ]]; then
    git -C "$src" remote set-url origin "$repo"
  fi
  git -C "$src" fetch --quiet --tags origin
  commit=$(git -C "$src" rev-parse --verify --quiet "origin/$ref^{commit}" || git -C "$src" rev-parse --verify "$ref^{commit}")
  SMG_IMAGE="smg-app:${commit:0:12}"
  if docker image inspect "$SMG_IMAGE" >/dev/null 2>&1; then
    info "  image $SMG_IMAGE is there already ($ref)"
    return 0
  fi
  info "  building $SMG_IMAGE from $ref on this server (a few minutes)"
  git -C "$src" -c advice.detachedHead=false checkout --quiet --force "$commit"
  # The build badge names the commit (the build has no .git, DECISIONS T346).
  docker build --quiet --build-arg SMG_BUILD_COMMIT="${commit:0:7}" -t "$SMG_IMAGE" "$src"
  SMG_CHANGES=$((SMG_CHANGES + 1))
}
