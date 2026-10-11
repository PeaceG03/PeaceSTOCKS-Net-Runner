#!/usr/bin/env bash
# Builds a pinned age release with `go install`. The module hash is checked against the Go checksum database
# (sum.golang.org) by the go command, and also against the h1 hash pinned here (from sum.golang.org's lookup
# for filippo.io/age@v1.2.1), so the source is not a file we downloaded ourselves. Adds age to the PATH.
set -euo pipefail
ver=v1.2.1
sum='h1:X0TZjehAZylOIj4DubWYU1vWQxv9bJpo+Uu2/LGhi1o='
dir="${RUNNER_TEMP:-/tmp}/age-bin"
mkdir -p "$dir"
export GOPROXY=https://proxy.golang.org GOSUMDB=sum.golang.org GONOSUMDB= GONOSUMCHECK= GOPRIVATE= GOINSECURE= GOFLAGS= GOTOOLCHAIN=local
got="$(cd "$dir" && go mod download -json "filippo.io/age@$ver" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("Sum",""))')"
[ "$got" = "$sum" ] || { echo "FAIL age module hash"; exit 1; }
GOBIN="$dir" go install "filippo.io/age/cmd/age@$ver" >/dev/null 2>&1 || { echo "FAIL age build"; exit 1; }
[ "$("$dir/age" --version)" = "$ver" ] || { echo "FAIL age version"; exit 1; }
[ -n "${GITHUB_PATH:-}" ] && echo "$dir" >> "$GITHUB_PATH"
echo "PASS age"
