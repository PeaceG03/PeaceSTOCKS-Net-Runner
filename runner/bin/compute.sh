#!/usr/bin/env bash
# N5 compute. Usage: compute.sh <net-dir> <out-dir> (after prepare-net.sh). Runs Net's daily entry point, which
# seeds its previous model from origin/results (Net's results branch) and writes only under <out-dir>/results/.
# NET_MODE=proof loads the newest stored session only and writes a private run file. PASS/FAIL only.
set -euo pipefail
net="$1"; out="$2"
mkdir -p "$out/results"
# The run sees sessions up to yesterday (UTC).
asof="$(date -u -d yesterday +%F)"
mode="${NET_MODE:-full}"
case "$mode" in full|proof) ;; *) echo "FAIL mode"; exit 1 ;; esac
export NODE_OPTIONS="--max-old-space-size=12288"
rc=0
(cd "$net" && ./node_modules/.bin/tsx src/run.ts --source "${NET_SOURCE:-sample}" --mode "$mode" --as-of "$asof" \
  --results "$out/results" --run-id "${GITHUB_RUN_ID:-local}" --seed-ref origin/results) >/dev/null 2>&1 || rc=$?
if [ "$rc" -ne 0 ]; then
  # Owner-dispatched diagnose runs seal Net's private run file (error/progress) instead of failing here.
  if [ "${NET_DIAG:-0}" = 1 ] && [ -n "$(find "$out/results/runs" -maxdepth 1 -name '*.json' -print -quit 2>/dev/null)" ]; then
    find "$out/results" -mindepth 1 -maxdepth 1 ! -name runs -exec rm -rf {} +
    echo "FAIL run (diagnostics sealed)"; exit 0
  fi
  echo "FAIL run"; exit 1
fi
if [ "$mode" = full ]; then
  [ -f "$out/results/models/latest.json" ] || { echo "FAIL no model"; exit 1; }
fi
echo "PASS compute"
