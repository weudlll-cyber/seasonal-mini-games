#!/usr/bin/env bash
# @file   ops/dev-drill.sh
# @module ops
# @brief  Development: the restore drill against the dev compose database, as on a server.
#
# Responsibility: dump the database of the dev stack (ops/compose.dev.yml, PostgreSQL on
#                 5510) with pg_dump -Fc into a backup file of the server's layout (db.dump
#                 and an uploads.tar, here empty: development has no uploads volume), then
#                 run the same drill as `smg restore --drill` (ops/lib/backup.sh): restore
#                 into a throw-away PostgreSQL container and count migrations, accounts,
#                 matches and round events. Nothing of the dev stack is changed; the work
#                 folder and the throw-away container go when the script ends. The file is
#                 not encrypted (no age key on a development machine); the server's backups
#                 are.
# Depends on:     ./lib/common.sh (cleanup), ./lib/backup.sh (do_drill), docker, ./compose.dev.yml
# Used by:        package.json (pnpm drill:dev), docs/operator-guide.md
# Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §6
#
# Usage: bash ops/dev-drill.sh   (with the dev stack up: pnpm dev or docker compose … up -d)
set -euo pipefail
shopt -s inherit_errexit

OPS=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "$OPS/lib/common.sh"
# shellcheck source=lib/backup.sh
source "$OPS/lib/backup.sh"

work=$(mktemp -d)
cleanup_path "$work"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
info "Dumping the dev database (compose project of ops/compose.dev.yml)"
docker compose --env-file "$OPS/.env.dev.example" -f "$OPS/compose.dev.yml" \
  exec -T postgres pg_dump -U smg -Fc smg >"$work/db.dump"
tar -C "$work" -cf "$work/uploads.tar" --files-from /dev/null
tar -C "$work" -cf "$work/smg-dev-$stamp.tar" db.dump uploads.tar
info "Backup file: $(du -h "$work/smg-dev-$stamp.tar" | cut -f1) — restoring it into a throw-away database"
do_drill "$work/smg-dev-$stamp.tar" ''
