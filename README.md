# PeaceSTOCKS-Net-Runner

Public compute runner for the private PeaceSTOCKS next-day network. It holds workflow plumbing only:
no network code, no data, no predictions and no scores.

- `compute` (schedule or owner dispatch on `main` only) reads the private code with a read-only deploy key from
  the main-only `net-read` environment, prepares Net (`runner/bin/prepare-net.sh`: pinned `npm ci` with no install scripts, plus the pinned public PeaceSTOCKS readers), proves the R2 token is read-only (`runner/bin/r2-probe.sh`: a tiny PUT must be refused), runs Net's daily entry point on the stored history in R2 (`runner/bin/compute.sh`; it seeds its previous model from Net's `results` branch; owner dispatch can pick `proof` to load only the newest session), the R2 secrets mapped into the reader's names in those two steps only, encrypts the results to `keys/results.age.pub`, and uploads them
  as a 1-day artifact. Logs say PASS or FAIL only.
- The private repo collects the artifact itself, checks that it came from a `main` schedule/dispatch run at
  Runner's `main` head, checks every path, and commits it. This repo holds no write credential.
- `leak-check` runs on every PR and push: path allowlist, secrets and personal info, data-shaped lines,
  noreply identities, owner-only scope for plumbing, and a no-PR-trigger rule for any workflow with secrets.
- `runner/bin/install-pre-push.sh <net-checkout>` installs a local hook that blocks any push containing Net text.
