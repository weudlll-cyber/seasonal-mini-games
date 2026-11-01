#!/usr/bin/env bash
# @file   ops/lib/backup.sh
# @module ops
# @brief  Backups: pg_dump + uploads → age → /var/backups/smg/<env>/, retention, restore, drill, timer.
#
# Responsibility: a backup is a tar of the database dump (pg_dump -Fc, inside the postgres
#                 container) and the uploads volume (read by a helper container, so a
#                 crash-looping app does not block it), encrypted with the operator's age
#                 public key (the server never holds the private key), written as .partial
#                 and renamed when complete; kept: the 14 newest plus the newest of each of 8
#                 older weeks. The plain dump lives in a work folder removed on exit. Files
#                 are readable by the group smg-backup (pulling without root). A restore asks
#                 first, refuses another environment's backup unless --force-env, and needs
#                 the operator's age identity file; a drill restores into a throw-away
#                 PostgreSQL container (readiness wait capped at 60 s) and counts the rows;
#                 the systemd timer runs `smg --env <env> backup` at 03:30.
# Depends on:     ./common.sh (compose, run, put_file, env_value, confirm, cleanup), age, docker
# Used by:        ops/smg, ops/install.sh (timer)
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §6; Bingo 03 §15

PG_IMAGE=postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
BACKUP_GROUP=smg-backup

# do_backup <env>: sets BACKUP_FILE to the new file (runs in this shell, so errors stop it).
do_backup() {
  local env=$1 dir="$SMG_BACKUPS/$1" work stamp out recipient image
  recipient=$(env_value "$SMG_ETC/$env.env" SMG_AGE_RECIPIENT)
  image=$(env_value "$SMG_ETC/$env.env" SMG_IMAGE)
  [[ -n $recipient ]] || die "no age public key in $SMG_ETC/$env.env (SMG_AGE_RECIPIENT)"
  command -v age >/dev/null || die "age is not installed (apt-get install age)"
  work=$(mktemp -d)
  cleanup_path "$work"
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  out="$dir/smg-$env-$stamp.tar.age"
  compose "$env" exec -T postgres pg_dump -U smg -Fc smg >"$work/db.dump"
  docker run --rm --entrypoint tar -v "smg-${env}_uploads:/data:ro" "$image" -C /data -cf - . >"$work/uploads.tar"
  install -d -m 0750 -g "$BACKUP_GROUP" "$SMG_BACKUPS" "$dir"
  cleanup_path "$out.partial"
  tar -C "$work" -cf - db.dump uploads.tar | age -r "$recipient" >"$out.partial"
  chgrp "$BACKUP_GROUP" "$out.partial"
  chmod 0640 "$out.partial"
  mv "$out.partial" "$out"
  prune_backups "$dir"
  # shellcheck disable=SC2034 # read by ops/smg after the call
  BACKUP_FILE=$out
}

# prune_backups <dir>: keeps the 14 newest (daily), and of the older ones the newest of each
# week for 8 weeks (weekly, counted apart from the dailies).
prune_backups() {
  local dir=$1 file week kept=0 weeks=()
  while IFS= read -r file; do
    kept=$((kept + 1))
    ((kept <= 14)) && continue
    week=$(date -u -d "$(basename "$file" | sed -E 's/.*-([0-9]{8})T.*/\1/')" +%G%V)
    if [[ " ${weeks[*]} " != *" $week "* && ${#weeks[@]} -lt 8 ]]; then
      weeks+=("$week")
    else
      rm -f "$file"
    fi
  done < <(find "$dir" -maxdepth 1 -name 'smg-*.tar.age' | sort -r)
}

# unpack <file> <identity> <dir>: decrypts (when .age) and unpacks a backup into <dir>.
unpack() {
  local file=$1 identity=$2 dir=$3
  if [[ $file == *.age ]]; then
    [[ -n $identity ]] || die "this backup is encrypted: pass your age key file with --identity <file>"
    age -d -i "$identity" "$file" | tar -C "$dir" -xf -
  else
    tar -C "$dir" -xf "$file"
  fi
  [[ -s $dir/db.dump ]] || die "no database dump in $file"
}

# do_restore <env> <file> <identity> <force-env>: replaces the database and the uploads.
do_restore() {
  local env=$1 file=$2 work
  if [[ $(basename "$file") != smg-"$env"-* && $4 != 1 ]]; then
    die "$(basename "$file") is not a backup of $env; pass --force-env to restore it anyway"
  fi
  confirm "Restore $(basename "$file") over the live $env data? Everything since that backup is lost."
  work=$(mktemp -d)
  cleanup_path "$work"
  unpack "$file" "$3" "$work"
  compose "$env" stop app
  restore_database "$env" "$work/db.dump"
  compose "$env" run --rm -T --no-deps --entrypoint sh app -c 'rm -rf /data/* && tar -C /data -xf -' <"$work/uploads.tar"
  compose "$env" start app
  wait_ready "$env"
}

# restore_database <env> <dump>: empties the schema, then restores in one transaction that
# stops at the first error (no half-restored database).
restore_database() {
  compose "$1" exec -T postgres psql -U smg -d smg -q -c 'DROP SCHEMA IF EXISTS smg CASCADE'
  compose "$1" exec -T postgres pg_restore -U smg -d smg --no-owner --single-transaction --exit-on-error <"$2"
}

# do_drill <file> <identity>: restores into a throw-away database and counts what came back.
do_drill() {
  local work name="smg-drill-$$" counts i
  work=$(mktemp -d)
  cleanup_path "$work"
  unpack "$1" "$2" "$work"
  cleanup_container "$name"
  docker run -d --rm --name "$name" -e POSTGRES_USER=smg -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=smg "$PG_IMAGE" >/dev/null
  for i in $(seq 1 60); do
    docker exec "$name" pg_isready -U smg -d smg >/dev/null 2>&1 && break
    ((i < 60)) || die "the throw-away database did not start within 60 s"
    sleep 1
  done
  sleep 2
  docker exec -i "$name" pg_restore -U smg -d smg --no-owner --exit-on-error <"$work/db.dump"
  counts=$(docker exec "$name" psql -U smg -d smg -tA -c \
    "SELECT (SELECT count(*) FROM smg.schema_migrations) || ' migrations, ' || (SELECT count(*) FROM smg.accounts) || ' accounts, ' || (SELECT count(*) FROM smg.matches) || ' matches, ' || (SELECT count(*) FROM smg.round_events) || ' events'")
  [[ -n $counts ]] || die "the drill restored nothing readable"
  info "drill passed: $counts; uploads $(tar -tf "$work/uploads.tar" | wc -l) entries"
}

# install_backup_units <env>: the backup group, age, and the systemd timer for 03:30.
install_backup_units() {
  local env=$1
  getent group "$BACKUP_GROUP" >/dev/null || run groupadd --system "$BACKUP_GROUP"
  if ! command -v age >/dev/null; then
    run apt-get update -q
    run apt-get install -y -q age
  fi
  put_file /etc/systemd/system/smg-backup@.service 0644 <<'EOF'
[Unit]
Description=Seasonal Mini Games backup (%i)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/opt/smg/smg --env %i backup
EOF
  put_file /etc/systemd/system/smg-backup@.timer 0644 <<'EOF'
[Unit]
Description=Seasonal Mini Games backup (%i) every night at 03:30

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
  run systemctl daemon-reload
  run systemctl enable --now "smg-backup@$env.timer"
}
