#!/usr/bin/env bash
# shellcheck source-path=SCRIPTDIR
# @file   ops/test/checkout-ref.test.sh
# @module ops/test
# @brief  The installer builds the code it was cloned with: checkout_ref names the checkout's branch.
#
# Responsibility: in throw-away git repositories, ops/lib/config.sh's checkout_ref gives the
#                 branch a clone is on (a clone of feat/x installs feat/x, not master), the
#                 commit when the checkout is detached, and nothing outside a checkout (the
#                 installer then falls back to master). Seconds; no root, no Docker.
# Depends on:     bash, git, ../lib/common.sh, ../lib/config.sh
# Used by:        the operator or a night run, by hand: bash ops/test/checkout-ref.test.sh
# Spec:           docs/spec/10-repository-structure.md §6; DECISIONS T244
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/common.sh
source "$HERE/../lib/common.sh"
# shellcheck source=../lib/config.sh
source "$HERE/../lib/config.sh"

WORK=$(mktemp -d)
cleanup_path "$WORK"
fail() {
  printf 'FAILED: %s\n' "$*" >&2
  exit 1
}
g() { git -C "$WORK/$1" -c user.name=test -c user.email=test@example.org "${@:2}"; }

git init --quiet -b master "$WORK/origin"
g origin commit --quiet --allow-empty -m first
g origin branch feat/x
git clone --quiet -b feat/x "$WORK/origin" "$WORK/clone"
mkdir -p "$WORK/clone/ops" "$WORK/plain"

[[ $(checkout_ref "$WORK/clone/ops") == feat/x ]] || fail "a clone of feat/x gave \"$(checkout_ref "$WORK/clone/ops")\""
commit=$(g clone rev-parse HEAD)
g clone -c advice.detachedHead=false checkout --quiet "$commit"
[[ $(checkout_ref "$WORK/clone/ops") == "$commit" ]] || fail "a detached checkout did not give its commit"
[[ -z $(checkout_ref "$WORK/plain") ]] || fail "a folder outside a checkout gave a ref"
printf 'checkout-ref test passed\n'
