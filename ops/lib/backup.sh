#!/usr/bin/env bash
# @file   ops/lib/backup.sh
# @module ops
# @brief  This server's settings for the kit's backup script, the keys it keeps, and the timer.
#
# Responsibility: backups, restore and drill are the kit's ops/backup.sh (DECISIONS T431; its
#                 docs/OPERATIONS.md says what a backup is, what is kept and what a restore
#                 refuses), taken from the app image into /opt/smg/kit/ops by the installer.
#                 Here: the settings of one environment (prefix smg, /var/backups/smg/<env>/,
#                 the group smg-backup, the database in its compose container with the schema
#                 smg, the uploads volume without the maintenance flag); stopping the app before
#                 a restore and, after it, setting up the database roles again (a restored
#                 database belongs to the superuser) and starting the stack, whose migration
#                 step grants the app role. The round and recovery keys are kept inside each
#                 backup as the secret file /etc/smg/<env>.keys, written from the env file
#                 (owner decision 2026-11-25, T437); `restore_keys` puts a backup's keys back
#                 into the env file, with the kit's own unpacking. The systemd timer runs
#                 `smg --env <env> backup` at 03:30.
# Depends on:     ./common.sh (compose, run, put_file, env_value, set_env_value), ./config.sh
#                 (apply_db_roles), the kit's backup.sh, age, docker
# Used by:        ops/smg, ops/install.sh (keys, first backup, timer), ops/dev-drill.sh
#                 (PG_IMAGE)
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §6; Bingo 03 §15

PG_IMAGE=postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
BACKUP_GROUP=smg-backup
KIT_BACKUP=${KIT_BACKUP:-$SMG_ROOT/kit/ops/backup.sh}

# write_keys <env>: the secret file every backup keeps, from the env file's two keys.
write_keys() {
  local file="$SMG_ETC/$1.env" key value text=''
  for key in SMG_ROUND_KEY SMG_RECOVERY_KEY; do
    value=$(env_value "$file" "$key")
    [[ -n $value || $SMG_DRY_RUN == 1 ]] || die "$key is missing in $file: run ops/install.sh again"
    text+="$key='$value'"$'\n'
  done
  printf '%s' "$text" | put_file "$SMG_ETC/$1.keys" 0600
}

# backup_settings <env>: exports the kit's SK_BACKUP_* settings of this environment.
backup_settings() {
  local env=$1 file="$SMG_ETC/$1.env" here part
  export SK_BACKUP_PREFIX=smg SK_BACKUP_ENV="$env" SK_BACKUP_DIR="$SMG_BACKUPS/$env"
  export SK_BACKUP_DB_CONTAINER="smg-$env-postgres-1" SK_BACKUP_DB_USER=smg SK_BACKUP_DB_NAME=smg
  export SK_BACKUP_DB_SCHEMA=smg SK_BACKUP_GROUP="$BACKUP_GROUP" SK_BACKUP_PG_IMAGE="$PG_IMAGE"
  # The uploads volume; the maintenance flag in it is live state, not data.
  export SK_BACKUP_VOLUMES="smg-${env}_uploads" SK_BACKUP_VOLUME_EXCLUDES=./maintenance
  # The keys without which a restored database cannot open what it sealed.
  export SK_BACKUP_SECRET_FILES="$SMG_ETC/$env.keys"
  SK_BACKUP_AGE_RECIPIENT=$(env_value "$file" SMG_AGE_RECIPIENT)
  SK_BACKUP_HELPER_IMAGE=$(env_value "$file" SMG_IMAGE)
  export SK_BACKUP_AGE_RECIPIENT SK_BACKUP_HELPER_IMAGE
  # A restore stops the app before and starts the stack after, each in a shell of its own.
  here='set -e'
  for part in common config backup; do here+="; source $(printf '%q' "$SMG_ROOT/lib/$part.sh")"; done
  SK_BACKUP_STOP_CMD="$here; compose $(printf '%q' "$env") stop app"
  SK_BACKUP_START_CMD="$here; start_after_restore $(printf '%q' "$env")"
  export SK_BACKUP_STOP_CMD SK_BACKUP_START_CMD
}

# start_after_restore <env>: the roles again, then the whole stack (`up`, not `start`: the
# migration step must run again to grant the app role).
start_after_restore() {
  apply_db_roles "$1"
  compose "$1" up -d
  wait_ready "$1"
}

# do_backup <env>: one backup now, for the installer; the kit says the new file's name.
do_backup() (
  backup_settings "$1"
  [[ -f $KIT_BACKUP ]] || die "the backup script is missing ($KIT_BACKUP): run ops/install.sh again"
  bash "$KIT_BACKUP" backup
)

# restore_keys <env> <backup> <age identity file> <force 0|1>: the backup's round and recovery
# keys into the env file (a server set up anew has keys of its own); the caller restarts.
restore_keys() (
  env=$1
  backup_settings "$env"
  # shellcheck source=/dev/null
  SK_BACKUP_SOURCE_ONLY=1 source "$KIT_BACKUP"
  check_env "$2" "$4"
  new_work
  unpack "$2" "$3" "$WORK"
  check_manifest "$WORK" "$4"
  restore_secrets "$WORK" "$WORK/keys" 1 >/dev/null
  keys=$(find "$WORK" -path '*/keys/*.keys' | head -n 1)
  [[ -n $keys ]] || die "$(basename "$2") holds no keys (a backup from before 2026-11-26)"
  for key in SMG_ROUND_KEY SMG_RECOVERY_KEY; do
    value=$(env_value "$keys" "$key")
    [[ -n $value ]] || die "the backup's keys lack $key: nothing changed"
    set_env_value "$SMG_ETC/$env.env" "$key" "$value"
  done
  write_keys "$env"
  info "The round and recovery keys of $(basename "$2") are in $SMG_ETC/$env.env."
)

# install_backup_units <env>: the backup group and folder, age, and the systemd timer for 03:30.
install_backup_units() {
  local env=$1
  getent group "$BACKUP_GROUP" >/dev/null || run groupadd --system "$BACKUP_GROUP"
  if ! command -v age >/dev/null; then
    run apt-get update -q
    run apt-get install -y -q age
  fi
  # The folder above the environment's: readable by the pulling group, as the files are.
  run install -d -m 0750 -g "$BACKUP_GROUP" "$SMG_BACKUPS"
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
