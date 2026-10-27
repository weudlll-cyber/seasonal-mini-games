#!/usr/bin/env bash
# @file   ops/pull-backups.sh
# @module ops
# @brief  Copies the server's encrypted backups to this computer (rsync over SSH).
#
# Responsibility: run on the operator's own Linux or macOS computer: fetch the backup files
#                 of one environment from /var/backups/smg/<env>/ on the server that are not
#                 here yet into a local folder (default ~/smg-backups/<env>), as a user in
#                 the group smg-backup. rsync writes each file under a temporary name and
#                 renames it when complete, so a cut-off copy never counts; no backup on the
#                 server yet is a plain message. The files stay age-encrypted; only the
#                 operator's age key opens them. Windows: ops/pull-backups.ps1.
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §6, §9; docs/operator-guide.md
#
# Usage: ops/pull-backups.sh <user@server> [prod|staging] [target folder]
set -euo pipefail

server=${1:?usage: pull-backups.sh <user@server> [prod|staging] [target folder]}
env=${2:-prod}
target=${3:-$HOME/smg-backups/$env}
[[ $env =~ ^(prod|staging)$ ]] || {
  echo "The environment is prod or staging, not \"$env\"." >&2
  exit 1
}
mkdir -p "$target"
# The folder appears with the first backup; an SSH failure stops here (set -e).
# shellcheck disable=SC2029 # $env is checked above and is meant to expand here
found=$(ssh "$server" "test -d /var/backups/smg/$env && echo yes || echo no")
if [[ $found == no ]]; then
  echo "No backups on $server yet (the first runs at 03:30, or: sudo smg backup)."
  exit 0
fi
# --ignore-existing: a file once here is never fetched again.
rsync -av --ignore-existing --include='smg-*.tar.age' --exclude='*' \
  "$server:/var/backups/smg/$env/" "$target/"
echo "Backups of $env are in $target"
