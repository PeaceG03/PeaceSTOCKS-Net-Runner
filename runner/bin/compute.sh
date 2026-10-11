#!/usr/bin/env bash
# N0 placeholder compute. Usage: compute.sh <net-dir> <out-dir>. Writes only under <out-dir>/results/.
# Later milestones run Net's own entry point here. Prints PASS/FAIL only; never prints data.
set -euo pipefail
net="$1"; out="$2"
[ -f "$net/README.md" ] || { echo "FAIL net checkout"; exit 1; }
mkdir -p "$out/results/n0"
run="${GITHUB_RUN_ID:-local}"
printf '{"schema":"net-results:v0","dummy":true,"runner_run_id":"%s","runner_sha":"%s"}\n' "$run" "${GITHUB_SHA:-local}" > "$out/results/n0/dummy-$run.json"
echo "PASS compute"
