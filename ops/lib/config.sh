#!/usr/bin/env bash
# @file   ops/lib/config.sh
# @module ops
# @brief  The install's files: env file with secrets, install record, stack files, the app image.
#
# Responsibility: read the answers of an earlier run back from /etc/smg/<env>.env, so a
#                 re-run (also with --yes) keeps them; write that file (0600, values
#                 single-quoted for Compose, written atomically) — secrets made once with
#                 openssl rand and kept on every later run, the public URL, base path and
#                 trusted proxy for the install type, admin e-mail, the operator's age key
#                 (the round key SMG_ROUND_KEY seals round seeds at rest, 05 §3: made once,
#                 never changed, or running rounds could not be recovered); write the install
#                 record /etc/smg/install.conf; copy the compose files, Caddyfile, the smg CLI and its
#                 library to /opt/smg;
#                 build the app image on the server from a git ref (until a signed release
#                 image exists), skipping it when the image of that commit is there, and
#                 drop app images older than the current and the previous one.
# Depends on:     ./common.sh (put_file, run, env_value), git, docker, openssl
# Used by:        ops/install.sh, ops/smg (update)
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
  for key in SMG_ADMIN_EMAIL SMG_AGE_RECIPIENT SMG_WEBSITE_NETWORK; do
    [[ -n ${!key:-} ]] || printf -v "$key" '%s' "$(env_value "$file" "$key")"
  done
}

# KEY='value' — Compose then takes the value literally; a single quote cannot be written so.
quoted() {
  [[ $2 != *"'"* ]] || die "$1 must not contain a single quote (')"
  printf "%s='%s'\n" "$1" "$2"
}

# write_env <env>: from the answers in SMG_* variables; secrets survive a re-run.
write_env() {
  local env=$1 file="$SMG_ETC/$1.env" pg round public base site tls key
  pg=$(env_value "$file" POSTGRES_PASSWORD)
  round=$(env_value "$file" SMG_ROUND_KEY)
  [[ -n $pg ]] || pg=$(secret 24)
  [[ -n $round ]] || round=$(secret 32)
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
    quoted DATABASE_URL "postgres://smg:$pg@postgres:5432/smg"
    quoted SMG_ROUND_KEY "$round"
    quoted SMG_PUBLIC_URL "$public"
    quoted SMG_BASE_PATH "$base"
    quoted SMG_TRUSTED_PROXIES "$SMG_TRUSTED_PROXIES"
    quoted SMG_SITE_ADDRESS "$site"
    quoted SMG_TLS "$tls"
    for key in SMG_WEBSITE_NETWORK SMG_ADMIN_EMAIL SMG_AGE_RECIPIENT; do
      quoted "$key" "${!key:-}"
    done
    quoted SMG_LOG_LEVEL info
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

# install_files <source dir of ops/>: the stack files and the CLI into /opt/smg.
install_files() {
  local from=$1 name
  for name in compose.yml compose.website.yml; do
    put_file "$SMG_ROOT/$name" 0644 <"$from/$name"
  done
  put_file "$SMG_ROOT/caddy/Caddyfile" 0644 <"$from/Caddyfile"
  for name in common.sh host.sh website.sh config.sh backup.sh; do
    put_file "$SMG_ROOT/lib/$name" 0644 <"$from/lib/$name"
  done
  put_file "$SMG_ROOT/smg" 0755 <"$from/smg"
  [[ -L /usr/local/bin/smg ]] || run ln -sf "$SMG_ROOT/smg" /usr/local/bin/smg
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
  docker build --quiet -t "$SMG_IMAGE" "$src"
  SMG_CHANGES=$((SMG_CHANGES + 1))
}

# prune_images <keep…>: removes smg-app images other than the ones named (current, previous).
prune_images() {
  local image
  for image in $(docker image ls smg-app --format '{{.Repository}}:{{.Tag}}'); do
    [[ " $* " == *" $image "* ]] || docker image rm "$image" >/dev/null 2>&1 || true
  done
}
