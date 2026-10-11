// Per-PR / push leak check for the public Runner (no Net access, no secrets). Prints paths, line numbers and
// kinds only. Env: LEAK_BASE_SHA (range base), LEAK_REQUIRE_BASE, PR_AUTHOR, PR_HEAD_REPO, GITHUB_REPOSITORY.
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { isNoreply, pathProblem, PROTECTED, scanText, workflowProblems } from "../lib/leak.mjs";

const OWNER = "PeaceG03";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 });
const base = process.env.LEAK_BASE_SHA ?? "";
let failures = 0;
const fail = (m) => { failures += 1; console.log(`LEAK FAIL ${m}`); };

const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
for (const path of tracked) {
  const why = pathProblem(path);
  if (why) fail(`${path}: ${why}`);
  for (const f of scanText(path)) fail(`path name ${path}: ${f.kind}`);
  const st = lstatSync(path);
  if (st.isSymbolicLink()) { fail(`${path}: symlink`); continue; }
  if (!st.isFile()) continue;
  if (st.size > 200_000) { fail(`${path}: file too large for the Runner`); continue; }
  const content = readFileSync(path);
  if (content.includes(0)) { fail(`${path}: binary file`); continue; }
  const text = content.toString("utf8");
  // The leak rules themselves describe the patterns they look for; scan them for secrets only.
  const findings = path.startsWith("runner/lib/") || path.startsWith("runner/test/")
    ? scanText(text).filter((f) => !["numeric-data", "market-data"].includes(f.kind))
    : scanText(text);
  for (const f of findings) fail(`${path}:${f.line}: ${f.kind}`);
  if (path.startsWith(".github/workflows/")) for (const p of workflowProblems(text)) fail(`${path}: ${p}`);
}

if (/^[0-9a-f]{40}$/.test(base)) {
  for (const v of git("log", "--format=%ae%n%ce", `${base}..HEAD`).split("\n").filter(Boolean))
    if (!isNoreply(v)) fail("commit email is not a noreply address");
  if (process.env.LEAK_SKIP_SCOPE !== "true") {
    const owner = process.env.PR_AUTHOR === OWNER && process.env.PR_HEAD_REPO === process.env.GITHUB_REPOSITORY;
    for (const path of git("diff", "--name-only", "--no-renames", "-z", `${base}...HEAD`).split("\0").filter(Boolean))
      if (PROTECTED.test(path) && !owner) fail(`scope ${path}: protected path; only an owner PR from this repository may change it`);
  }
} else if (process.env.LEAK_REQUIRE_BASE === "true") {
  fail("missing base commit for PR range");
}

if (failures > 0) process.exit(1);
console.log(`LEAK PASS files=${tracked.length}`);
