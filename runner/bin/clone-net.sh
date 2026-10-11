#!/usr/bin/env bash
# Shallow-clones private Net (read-only key) into the given directory, outside this checkout. Quiet.
set -euo pipefail
dest="$1"
here="$(cd "$(dirname "$0")/../.." && pwd)"
case "$dest" in "$here"|"$here"/*) echo "Net must be cloned outside the runner checkout" >&2; exit 1 ;; esac
if ! "$here/runner/bin/with-deploy-key.sh" git clone --quiet --depth 1 --no-tags git@github.com:PeaceG03/PeaceSTOCKS-Net.git "$dest" >/dev/null 2>&1; then
  echo "FAIL net read"; exit 1
fi
echo "PASS net read"
