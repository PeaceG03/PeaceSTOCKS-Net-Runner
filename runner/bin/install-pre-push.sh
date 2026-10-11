#!/usr/bin/env bash
# Installs a git pre-push hook in this Runner clone (adapted from PeaceAI-Workspace install-pre-push.sh).
# Before any push it scans EVERY pushed commit for Net text against a local Net checkout, plus the Runner path
# allowlist, secrets and noreply identities, and blocks the push on a hit. Usage: install-pre-push.sh <net-dir>.
# The Net path is stored only in this clone's .git/hooks; nothing about Net is committed.
set -euo pipefail
here="$(cd "$(dirname "$0")/../.." && pwd)"
net="${1:-${NET_DIR:-}}"
[ -n "$net" ] || { echo "usage: install-pre-push.sh <net-dir> (or set NET_DIR)" >&2; exit 2; }
net="$(cd "$net" && pwd)"
git -C "$net" rev-parse --git-dir >/dev/null 2>&1 || { echo "install-pre-push: $net is not a git checkout" >&2; exit 2; }
case "$net" in "$here"|"$here"/*) echo "install-pre-push: Net must live outside the Runner clone" >&2; exit 2 ;; esac
command -v node >/dev/null || { echo "install-pre-push: node is required" >&2; exit 2; }
hooks="$(git -C "$here" rev-parse --git-path hooks)"; case "$hooks" in /*) ;; *) hooks="$here/$hooks" ;; esac
snap="$(git -C "$here" rev-parse --git-path net-prepush)"; case "$snap" in /*) ;; *) snap="$here/$snap" ;; esac
rm -rf "$snap"; mkdir -p "$snap/bin" "$snap/lib" "$hooks"
cp "$here/runner/bin/prepush-scan.mjs" "$snap/bin/"
cp "$here/runner/lib/leak.mjs" "$here/runner/lib/nettext.mjs" "$snap/lib/"
net_q="$(printf '%q' "$net")"; snap_q="$(printf '%q' "$snap")"
cat > "$hooks/pre-push" <<HOOK
#!/usr/bin/env bash
# Runner pre-push scan (installed by runner/bin/install-pre-push.sh). Blocks the push on any hit.
set -euo pipefail
export NET_DIR="\${NET_DIR:-$net_q}"
zero="0000000000000000000000000000000000000000"
commits=""
while read -r _lref lsha _rref rsha; do
  [ "\$lsha" = "\$zero" ] && continue
  if [ "\$rsha" != "\$zero" ] && git cat-file -e "\$rsha^{commit}" 2>/dev/null; then
    commits="\$commits \$(git rev-list "\$rsha..\$lsha")"
  else
    commits="\$commits \$(git rev-list "\$lsha" --not --remotes)"
  fi
done
[ -z "\${commits// /}" ] && { echo "PRE-PUSH PASS commits=0"; exit 0; }
printf '%s\n' "\$commits" | node $snap_q/bin/prepush-scan.mjs
HOOK
chmod 755 "$hooks/pre-push"
echo "pre-push hook installed (scanner snapshot in .git; re-run after changing the scanner)"
