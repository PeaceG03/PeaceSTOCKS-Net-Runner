#!/usr/bin/env bash
# Usage: prepare-net.sh <net-dir>. Installs Net's pinned dependencies (no install scripts) and the pinned
# public PeaceSTOCKS readers Net decodes stored Reply Dust with. Prints PASS/FAIL only.
set -euo pipefail
net="$1"
[ -f "$net/package-lock.json" ] && [ -f "$net/src/run.ts" ] || { echo "FAIL net checkout"; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || { echo "FAIL node version"; exit 1; }
command -v zstd >/dev/null || { echo "FAIL zstd"; exit 1; }
(cd "$net" && npm ci --ignore-scripts --no-audit --no-fund --loglevel=error) >/dev/null 2>&1 || { echo "FAIL deps"; exit 1; }
(cd "$net" && ./scripts/link-peacestocks.sh .deps-peacestocks) >/dev/null 2>&1 || { echo "FAIL readers"; exit 1; }
echo "PASS prepare"
