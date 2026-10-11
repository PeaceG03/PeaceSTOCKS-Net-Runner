#!/usr/bin/env bash
# Packs <out-dir>/results into a tar and encrypts it to the committed public recipient. Usage:
# seal.sh <out-dir> <sealed-file>. Only regular files and directories under results/ are packed; the
# plaintext tar never leaves $RUNNER_TEMP. Prints PASS/FAIL only.
set -euo pipefail
out="$1"; sealed="$2"
here="$(cd "$(dirname "$0")/../.." && pwd)"
recipient="$here/keys/results.age.pub"
[ -d "$out/results" ] || { echo "FAIL nothing to seal"; exit 1; }
if [ -n "$(find "$out/results" ! -type f ! -type d -print -quit)" ]; then echo "FAIL non-regular file in results"; exit 1; fi
mkdir -p "$(dirname "$sealed")"
tmp="$(mktemp "${RUNNER_TEMP:-/tmp}/results.XXXXXX.tar")"
trap 'rm -f "$tmp"' EXIT
tar --sort=name --owner=0 --group=0 --numeric-owner -C "$out" -cf "$tmp" results
age -R "$recipient" -o "$sealed" "$tmp"
echo "PASS seal"
