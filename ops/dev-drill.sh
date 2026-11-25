#!/usr/bin/env bash
# @file   ops/dev-drill.sh
# @module ops
# @brief  Development: the restore drill against the dev compose database, as on a server.
#
# Responsibility: a backup of the dev stack's database (ops/compose.dev.yml, PostgreSQL on
#                 5510) with the kit's ops/backup.sh, encrypted to a key made for this run, then
#                 the same script's drill: restore into a throw-away PostgreSQL container and
#                 compare every table's rows with the rows the dump carries. Development has no
#                 uploads volume. Nothing of the dev stack is changed; the work folder (backup
#                 and key) and the throw-away container go when the script ends.
# Depends on:     the kit's backup.sh (node_modules), ./lib/common.sh (die, cleanup_path),
#                 ./lib/backup.sh (PG_IMAGE), age, age-keygen, docker, ./compose.dev.yml
# Used by:        package.json (pnpm drill:dev), docs/operator-guide.md
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §6
#
# Usage: bash ops/dev-drill.sh   (with the dev stack up: pnpm dev or docker compose … up -d)
set -euo pipefail
shopt -s inherit_errexit

OPS=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
KIT="$OPS/../apps/server/node_modules/@seasonal/kit/ops/backup.sh"
# shellcheck source=lib/common.sh
source "$OPS/lib/common.sh"
# shellcheck source=lib/backup.sh
source "$OPS/lib/backup.sh"

[[ -f $KIT ]] || die "run pnpm install first ($KIT is missing)"
command -v age-keygen >/dev/null || die "age is not installed"
work=$(mktemp -d)
cleanup_path "$work"
age-keygen -o "$work/key.txt" 2>/dev/null
# Git Bash on Windows cannot set a folder's mode (the kit's script is written for the server):
# there the one `install -d` of a backup only makes the folder.
if [[ $OSTYPE == msys ]]; then
  install() { mkdir -p "${@: -1}"; }
  export -f install
fi
export SK_BACKUP_PREFIX=smg SK_BACKUP_ENV=dev SK_BACKUP_DIR="$work/backups"
export SK_BACKUP_DB_CONTAINER=smg-dev-postgres-1 SK_BACKUP_DB_USER=smg SK_BACKUP_DB_NAME=smg
export SK_BACKUP_PG_IMAGE="$PG_IMAGE"
SK_BACKUP_AGE_RECIPIENT=$(age-keygen -y "$work/key.txt")
export SK_BACKUP_AGE_RECIPIENT
bash "$KIT" backup
files=("$work"/backups/smg-dev-*.tar.age)
bash "$KIT" drill "${files[0]}" --identity "$work/key.txt"
