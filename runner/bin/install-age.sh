#!/usr/bin/env bash
# Installs a pinned age release (sha256-checked) into $RUNNER_TEMP/age-bin and adds it to the PATH.
set -euo pipefail
ver=v1.2.1
sum=7df45a6cc87d4da11cc03a539a7470c15b1041ab2b396af088fe9990f7c79d50
dir="${RUNNER_TEMP:-/tmp}/age-bin"
mkdir -p "$dir"
curl -fsSL -o "$dir/age.tgz" "https://github.com/FiloSottile/age/releases/download/$ver/age-$ver-linux-amd64.tar.gz"
echo "$sum  $dir/age.tgz" | sha256sum -c --quiet - || { echo "FAIL age checksum"; exit 1; }
tar -xzf "$dir/age.tgz" -C "$dir" --strip-components=1 age/age
rm -f "$dir/age.tgz"
[ -n "${GITHUB_PATH:-}" ] && echo "$dir" >> "$GITHUB_PATH"
echo "PASS age"
