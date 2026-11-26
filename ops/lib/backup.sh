#!/usr/bin/env bash
# @file   ops/lib/backup.sh
# @module ops
# @brief  This server's settings for the kit's backup script, and the nightly timer.
#
# Responsibility: backups, restore and drill are the kit's ops/backup.sh (DECISIONS T431; its
#                 docs/OPERATIONS.md says what a backup is, what is kept and what a restore
#                 refuses), taken from the app image into /opt/smg/kit/ops by the installer.
#                 Here: the settings of one environment (prefix smg, /var/backups/smg/<env>/,
#                 the group smg-backup, the database in its compose container with the schema
#                 smg, the uploads volume without the maintenance flag), asking before a restore,
#                 stopping the app before it and, after it, setting up the database roles again
#                 (a restored database belongs to the superuser) and starting the stack, whose
#                 migration step grants the app role; restoring a plain dump for a rollback,
#                 and the systemd timer that runs `smg --env <env> backup` at 03:30.
# Depends on:     ./common.sh (compose, run, put_file, env_value, confirm), ./config.sh
#                 (apply_db_roles), the kit's backup.sh, age, docker
# Used by:        ops/smg, ops/install.sh (timer), ops/dev-drill.sh (PG_IMAGE)
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §6; Bingo 03 §15

PG_IMAGE=postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
BACKUP_GROUP=smg-backup
KIT_BACKUP=${KIT_BACKUP:-$SMG_ROOT/kit/ops/backup.sh}

# kit_database <env>: names the environment's database for the kit's script.
kit_database() {
  export SK_BACKUP_DB_CONTAINER="smg-$1-postgres-1" SK_BACKUP_DB_USER=smg SK_BACKUP_DB_NAME=smg
  export SK_BACKUP_DB_SCHEMA=smg
}

# kit_backup <env> <command…>: the kit's script with this environment's settings, in a shell of
# its own so none of them stays behind.
kit_backup() (
  env=$1 file="$SMG_ETC/$1.env"
  shift
  [[ -f $KIT_BACKUP ]] || die "the backup script is missing ($KIT_BACKUP): run ops/install.sh again"
  kit_database "$env"
  export SK_BACKUP_PREFIX=smg SK_BACKUP_ENV="$env" SK_BACKUP_DIR="$SMG_BACKUPS/$env"
  export SK_BACKUP_GROUP="$BACKUP_GROUP" SK_BACKUP_PG_IMAGE="$PG_IMAGE"
  # The uploads volume; the maintenance flag in it is live state, not data.
  export SK_BACKUP_VOLUMES="smg-${env}_uploads" SK_BACKUP_VOLUME_EXCLUDES=./maintenance
  SK_BACKUP_AGE_RECIPIENT=$(env_value "$file" SMG_AGE_RECIPIENT)
  SK_BACKUP_HELPER_IMAGE=$(env_value "$file" SMG_IMAGE)
  export SK_BACKUP_AGE_RECIPIENT SK_BACKUP_HELPER_IMAGE
  bash "$KIT_BACKUP" "$@"
)

# do_backup <env>: sets BACKUP_FILE to the new file (a failure stops the calling script).
do_backup() {
  local env=$1 said
  [[ -n $(env_value "$SMG_ETC/$env.env" SMG_AGE_RECIPIENT) ]] ||
    die "no age public key in $SMG_ETC/$env.env (SMG_AGE_RECIPIENT)"
  # The folder above the environment's: readable by the pulling group, as the files are.
  install -d -m 0750 -g "$BACKUP_GROUP" "$SMG_BACKUPS"
  said=$(kit_backup "$env" backup)
  # shellcheck disable=SC2034 # read by ops/smg after the call
  BACKUP_FILE="$SMG_BACKUPS/$env/${said##*backup written: }"
}

# do_restore <env> <file> <identity> <force-env>: replaces the database and the uploads. The
# kit's script stops the app only after the file passed its checks.
do_restore() {
  local env=$1 file=$2 options=(--yes) in_shell
  [[ -z $3 ]] || options+=(--identity "$3")
  [[ $4 != 1 ]] || options+=(--force-env)
  confirm "Restore $(basename "$file") over the live $env data? Everything since that backup is lost."
  in_shell="set -e; source $(printf '%q' "$SMG_ROOT/lib/common.sh"); source $(printf '%q' "$SMG_ROOT/lib/config.sh")"
  SK_BACKUP_STOP_CMD="$in_shell; compose $(printf '%q' "$env") stop app" \
    SK_BACKUP_START_CMD="$in_shell; start_after_restore $(printf '%q' "$env")" \
    kit_backup "$env" restore "$file" "${options[@]}"
  wait_ready "$env"
}

# start_after_restore <env>: the roles again, then the whole stack (`up`, not `start`: the
# migration step must run again to grant the app role).
start_after_restore() {
  apply_db_roles "$1"
  compose "$1" up -d
}

# restore_dump <env> <dump>: a plain pg_dump file (a rollback's) over the schema, with the kit's
# one-transaction restore: the data goes only when the restore succeeded.
restore_dump() (
  kit_database "$1"
  # shellcheck source=/dev/null
  SK_BACKUP_SOURCE_ONLY=1 source "$KIT_BACKUP"
  restore_database "$2"
)

# do_drill <env> <file> <identity>: restores into a throw-away database and compares each table.
do_drill() {
  local options=()
  [[ -z $3 ]] || options+=(--identity "$3")
  kit_backup "$1" drill "$2" "${options[@]}"
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
