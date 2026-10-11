// Local pre-push scan for Runner pushes: every pushed commit is checked for Net text (hashed lines/shingles
// against a local Net checkout), Net paths, the Runner path allowlist, secrets/personal info and noreply
// identities. Commit shas on stdin; NET_DIR names the Net checkout. Prints short shas, paths and kinds only.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { indexNet, findNetText } from "../lib/nettext.mjs";
import { isNoreply, pathProblem, scanText } from "../lib/leak.mjs";

const netDir = process.env.NET_DIR ?? "";
if (!netDir || !existsSync(netDir)) { console.log("PRE-PUSH FAIL Net checkout not found (set NET_DIR); push blocked"); process.exit(1); }
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 });
const commits = [...new Set(readFileSync(0, "utf8").split(/\s+/).filter((s) => /^[0-9a-f]{40}$/.test(s)))];
const net = indexNet(netDir);
if (net.paths.size === 0) { console.log("PRE-PUSH FAIL Net checkout has no tracked files; push blocked"); process.exit(1); }
const SHARED = new Set(["README.md", "LICENSE", ".gitignore"]);
let failures = 0, files = 0;
const fail = (sha, m) => { failures += 1; console.log(`PRE-PUSH FAIL ${sha.slice(0, 10)} ${m}`); };
for (const sha of commits) {
  for (const v of git("log", "-1", "--format=%ae%n%ce", sha).split("\n").filter(Boolean)) if (!isNoreply(v)) fail(sha, "commit email is not a noreply address");
  for (const f of scanText(git("log", "-1", "--format=%B", sha))) fail(sha, `commit message:${f.line}: ${f.kind}`);
  const changed = git("diff-tree", "--root", "--no-commit-id", "-r", "-z", "--no-renames", "--diff-filter=AM", "--name-only", sha).split("\0").filter(Boolean);
  for (const path of changed) {
    files += 1;
    const why = pathProblem(path);
    if (why) fail(sha, `${path}: ${why}`);
    if (net.paths.has(path) && !SHARED.has(path) && !path.startsWith(".github/")) fail(sha, `${path}: same path as a Net file`);
    if (Number(git("cat-file", "-s", `${sha}:${path}`).trim()) > 2_000_000) { fail(sha, `${path}: too large`); continue; }
    const blob = execFileSync("git", ["cat-file", "blob", `${sha}:${path}`], { maxBuffer: 64 << 20 });
    if (blob.includes(0)) { fail(sha, `${path}: binary`); continue; }
    const text = blob.toString("utf8");
    const lib = path.startsWith("runner/lib/") || path.startsWith("runner/test/");
    for (const f of scanText(text)) if (!(lib && ["numeric-data", "market-data"].includes(f.kind))) fail(sha, `${path}:${f.line}: ${f.kind}`);
    const hits = findNetText(text, net);
    if (hits.lineHits + hits.shingleHits > 0) fail(sha, `${path}: Net text (${hits.lineHits} line, ${hits.shingleHits} shingle match(es))`);
  }
}
if (failures > 0) { console.log(`PRE-PUSH BLOCKED commits=${commits.length} files=${files} failures=${failures}`); process.exit(1); }
console.log(`PRE-PUSH PASS commits=${commits.length} files=${files}`);
