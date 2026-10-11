#!/usr/bin/env bash
# Shallow-clones private Net main and its results branch (read-only key) into the given directory, outside
# this checkout. Quiet. NET_REF (optional, owner dispatch only): a full 40-hex Net commit SHA; Net is then
# checked out at exactly that commit and `git rev-parse HEAD` must equal it, or the run fails closed.
# Empty NET_REF (scheduled runs): Net main.
set -euo pipefail
dest="$1"
ref="${NET_REF:-}"
if [ -n "$ref" ] && ! printf '%s' "$ref" | grep -Eq '^[0-9a-f]{40}$'; then echo "FAIL net ref format"; exit 1; fi
here="$(cd "$(dirname "$0")/../.." && pwd)"
case "$dest" in "$here"|"$here"/*) echo "Net must be cloned outside the runner checkout" >&2; exit 1 ;; esac
if ! "$here/runner/bin/with-deploy-key.sh" git clone --quiet --depth 1 --no-tags git@github.com:PeaceG03/PeaceSTOCKS-Net.git "$dest" >/dev/null 2>&1; then
  echo "FAIL net read"; exit 1
fi
echo "PASS net read"
if [ -n "$ref" ]; then
  if ! "$here/runner/bin/with-deploy-key.sh" git -C "$dest" fetch --quiet --depth 1 --no-tags origin "$ref" >/dev/null 2>&1 \
      || ! git -C "$dest" -c advice.detachedHead=false checkout --quiet --detach "$ref" >/dev/null 2>&1; then
    echo "FAIL net ref checkout"; exit 1
  fi
  [ "$(git -C "$dest" rev-parse HEAD)" = "$ref" ] || { echo "FAIL net ref verify"; exit 1; }
  echo "PASS net ref"
fi
# Net's results live on its `results` branch; the newest model there becomes this run's previous model.
if "$here/runner/bin/with-deploy-key.sh" git -C "$dest" ls-remote --exit-code --quiet origin refs/heads/results >/dev/null 2>&1; then
  if ! "$here/runner/bin/with-deploy-key.sh" git -C "$dest" fetch --quiet --depth 1 --no-tags origin \
      +refs/heads/results:refs/remotes/origin/results >/dev/null 2>&1; then
    echo "FAIL results read"; exit 1
  fi
  echo "PASS results read"
else
  echo "PASS results absent"
fi
