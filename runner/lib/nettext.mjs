// Detects text copied from a local Net checkout using hashed lines and hashed 4-line shingles
// (ported from PeaceAI-Workspace peaceai/lib/coretext.ts). Only hashes are kept; matched text is never printed.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const LONG_LINE = 60;
export const SHINGLE_LINE = 12;
export const SHINGLE_SIZE = 4;
const BOILERPLATE = /^(?:import\b.*\bfrom\s+["'][^"']+["'];?|import\s+["'][^"']+["'];?|export\s+(?:\*|\{[^}]*\})\s+from\s+["'][^"']+["'];?|(?:const|let|var)\s+\w+\s*=\s*require\(["'][^"']+["']\);?|#!\/usr\/bin\/env \w+|set -[euox]+(?: pipefail)?)$/;
const TEXT_EXT = /\.(?:[cm]?[jt]sx?|json|md|ya?ml|sh|py|txt|toml|cfg|ini|csv)$/i;
const normalize = (line) => line.trim().replace(/\s+/g, " ");
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 24);

function shingleKeys(normalized) {
  const usable = normalized.filter((l) => l.length >= SHINGLE_LINE && !BOILERPLATE.test(l));
  const keys = [];
  for (let i = 0; i + SHINGLE_SIZE <= usable.length; i += 1) keys.push(hash(usable.slice(i, i + SHINGLE_SIZE).join("\n")));
  return keys;
}

export function emptyIndex() { return { lines: new Set(), shingles: new Set(), paths: new Set() }; }

export function addText(index, text) {
  const normalized = text.split("\n").map(normalize);
  for (const l of normalized) if (l.length >= LONG_LINE && !BOILERPLATE.test(l)) index.lines.add(hash(l));
  for (const k of shingleKeys(normalized)) index.shingles.add(k);
}

/** Indexes Net's tracked files. Net's .github plumbing and README are not network code and are skipped. */
export function indexNet(dir) {
  const index = emptyIndex();
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: dir, encoding: "utf8", maxBuffer: 64 << 20 }).split("\0").filter(Boolean);
  for (const path of files) {
    index.paths.add(path);
    if (path.startsWith(".github/") || path === "README.md" || !TEXT_EXT.test(path)) continue;
    try {
      const full = join(dir, path);
      const st = statSync(full);
      if (st.isFile() && st.size <= 2_000_000) addText(index, readFileSync(full, "utf8"));
    } catch { /* unreadable: cannot match either way */ }
  }
  return index;
}

export function findNetText(text, net) {
  const normalized = text.split("\n").map(normalize);
  let lineHits = 0;
  for (const l of normalized) if (l.length >= LONG_LINE && !BOILERPLATE.test(l) && net.lines.has(hash(l))) lineHits += 1;
  let shingleHits = 0;
  for (const k of shingleKeys(normalized)) if (net.shingles.has(k)) shingleHits += 1;
  return { lineHits, shingleHits };
}
