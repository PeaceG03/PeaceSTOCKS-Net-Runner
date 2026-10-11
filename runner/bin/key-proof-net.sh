#!/usr/bin/env bash
# Key proof: (a) the Net key reads Net; (b) a push with it to a throwaway ref is denied (main is never probed).
set -uo pipefail
here="$(cd "$(dirname "$0")/../.." && pwd)"
key="$here/runner/bin/with-deploy-key.sh"
net="git@github.com:PeaceG03/PeaceSTOCKS-Net.git"
probe="refs/heads/net-deny-probe"
fail=0
if "$key" git ls-remote --heads "$net" >/dev/null 2>&1; then echo "PASS (a) net key can read Net"; else echo "FAIL (a) net key cannot read Net"; fail=1; fi
work="$(mktemp -d)"
git -C "$work" init -q
git -C "$work" -c user.name=PeaceG03 -c user.email=301894882+PeaceG03@users.noreply.github.com commit -q --allow-empty -m "deny probe"
err="$work/push.err"
if "$key" git -C "$work" push --quiet "$net" "HEAD:$probe" >/dev/null 2>"$err"; then
  echo "FAIL (b) !!! PUSH TO Net SUCCEEDED - key has WRITE access !!!"
  fail=1
  if "$key" git -C "$work" push --quiet "$net" ":$probe" >/dev/null 2>&1; then echo "INFO (b) probe ref deleted"; else echo "FAIL (b) probe ref could NOT be deleted"; fi
elif grep -qiE "read only|read-only|denied|not allowed|403" "$err"; then
  echo "PASS (b) net key push to Net denied"
else
  echo "FAIL (b) push failed for an unexpected reason (not a clear denial)"
  fail=1
fi
rm -rf "$work"
exit $fail
