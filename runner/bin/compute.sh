#!/usr/bin/env bash
# N5 compute. Usage: compute.sh <net-dir> <out-dir>. Installs Net's pinned dependencies (no install scripts) and
# runs Net's daily entry point, which seeds its previous model from origin/results (Net's results branch) and
# writes only under <out-dir>/results/. Prints PASS/FAIL only; never prints data.
set -euo pipefail
net="$1"; out="$2"
[ -f "$net/package-lock.json" ] && [ -f "$net/src/run.ts" ] || { echo "FAIL net checkout"; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || { echo "FAIL node version"; exit 1; }
(cd "$net" && npm ci --ignore-scripts --no-audit --no-fund --loglevel=error) >/dev/null 2>&1 || { echo "FAIL deps"; exit 1; }
mkdir -p "$out/results"
# The run sees sessions up to yesterday (UTC). NET_SOURCE stays "sample" (synthetic) until the R2 read token exists.
asof="$(date -u -d yesterday +%F)"
(cd "$net" && ./node_modules/.bin/tsx src/run.ts --source "${NET_SOURCE:-sample}" --as-of "$asof" \
  --results "$out/results" --run-id "${GITHUB_RUN_ID:-local}" --seed-ref origin/results) >/dev/null 2>&1 || { echo "FAIL run"; exit 1; }
[ -f "$out/results/models/latest.json" ] || { echo "FAIL no model"; exit 1; }
echo "PASS compute"
