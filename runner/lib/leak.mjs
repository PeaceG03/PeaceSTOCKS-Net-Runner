// Generic leak rules for the public Runner (ported from PeaceAI-Workspace peaceai/lib/leak.ts, plus Runner
// rules). Deliberately contains no Net code, no personal identifiers and no data values.
const NOREPLY = /^[A-Za-z0-9._%+-]+@users\.noreply\.github\.com$/i;
const ALLOWED_EMAIL_DOMAINS = /@(?:example\.(?:com|org|net)|users\.noreply\.github\.com)$/i;
const SSH_REMOTE = /^git@github\.com$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PATTERNS = [
  ["phone-number", /(?<![\w.])(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w.])/],
  ["phone-number", /(?<![\w])\+\d{1,3}[\s.-]?\d{2,4}[\s.-]\d{3,4}[\s.-]\d{3,4}(?![\w])/],
  ["home-path", /\/Users\/[A-Za-z0-9._-]+/],
  ["home-path", /\/home\/(?!runner\b|user\b|node\b)[A-Za-z0-9._-]+/],
  ["home-path", /[A-Za-z]:\\\\?Users\\\\?[A-Za-z0-9._ -]+/i],
  ["private-key", /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/],
  ["age-secret-key", /AGE-SECRET-KEY-1[0-9A-Z]{20,}/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["aws-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["slack-token", /\bxox[abpors]-[A-Za-z0-9-]{10,}\b/],
  ["openai-style-key", /\bsk-[A-Za-z0-9_-]{32,}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  // Data dumps: a line with 6+ decimal numbers (bars, predictions, scores, weights) does not belong here.
  ["numeric-data", /(?:-?\d+\.\d+[^\d.]+){5}-?\d+\.\d+/],
  // Stock-data shapes: an OHLC/VWAP-style record or a ticker:price pair.
  ["market-data", /\b(?:open|high|low|close|vwap|volume)\b["']?\s*[:=]\s*-?\d+(?:\.\d+)?/i],
];

export function scanText(text, extraTerms = []) {
  const findings = [];
  const terms = extraTerms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 3);
  text.split("\n").forEach((line, index) => {
    const lineNo = index + 1;
    for (const match of line.matchAll(EMAIL)) {
      const email = match[0];
      if (!NOREPLY.test(email) && !ALLOWED_EMAIL_DOMAINS.test(email) && !SSH_REMOTE.test(email)) findings.push({ kind: "email", line: lineNo });
    }
    const kinds = new Set(PATTERNS.filter(([, p]) => p.test(line)).map(([k]) => k));
    for (const kind of kinds) findings.push({ kind, line: lineNo });
    const lower = line.toLowerCase();
    if (terms.some((t) => lower.includes(t))) findings.push({ kind: "private-term", line: lineNo });
  });
  return findings;
}

export function parseTerms(raw) {
  return (raw ?? "").split(/\r?\n|,/).map((t) => t.trim()).filter((t) => t.length >= 3);
}

export const isNoreply = (value) => /@users\.noreply\.github\.com$|^noreply@github\.com$/i.test(value);

// The Runner holds workflow plumbing only. Anything else (results/, data, models, Net code) is refused.
const ALLOWED_PATH = /^(?:README\.md|LICENSE|\.gitignore|keys\/results\.age\.pub|\.github\/workflows\/[a-z0-9-]+\.yml|runner\/(?:bin|lib|test)\/[a-z0-9-]+(?:\.test)?\.(?:sh|mjs))$/;
export function pathProblem(path) {
  if (!ALLOWED_PATH.test(path)) return "path not allowed in the public Runner";
  return null;
}

// Paths only the owner may change, in a PR from this repository.
export const PROTECTED = /^(?:\.github\/|keys\/|runner\/|LICENSE$|\.gitignore$)/;

// Workflow rule: a workflow that touches a secret or an environment must never run on PR events.
export function workflowProblems(text) {
  const problems = [];
  if (/pull_request_target/.test(text)) problems.push("pull_request_target is never allowed");
  const usesSecrets = /\bsecrets\.|^\s*environment\s*:/m.test(text);
  const prTrigger = /^\s*-?\s*pull_request\s*:?\s*$|^\s*on\s*:.*\bpull_request\b/m.test(text);
  if (usesSecrets && prTrigger) problems.push("workflow with secrets or an environment has a pull_request trigger");
  if (/^\s*permissions\s*:\s*write-all/m.test(text)) problems.push("write-all permissions");
  if (/\bcontents\s*:\s*write\b/.test(text)) problems.push("contents: write on the public side");
  return problems;
}
