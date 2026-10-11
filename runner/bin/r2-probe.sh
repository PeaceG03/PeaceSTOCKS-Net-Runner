#!/usr/bin/env bash
# Usage: r2-probe.sh <net-dir>. Net's R2 token check: a tiny PUT under net-write-probe/<run-id> must be
# refused (an accepted write is deleted at once and fails the job), then one read must work.
# Only Net's PASS/FAIL lines are printed; stderr is dropped so no URL, key or error text reaches the log.
set -uo pipefail
net="$1"
outp="$(cd "$net" && ./node_modules/.bin/tsx src/r2-probe.ts --run-id "${GITHUB_RUN_ID:-local}" 2>/dev/null)"; rc=$?
printf '%s\n' "$outp" | grep -E '^(PASS|FAIL) [a-z0-9 :()-]+$' || echo "FAIL r2 probe"
exit "$rc"
