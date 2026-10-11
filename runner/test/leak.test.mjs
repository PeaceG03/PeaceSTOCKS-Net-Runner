import { test } from "node:test";
import assert from "node:assert/strict";
import { pathProblem, scanText, workflowProblems } from "../lib/leak.mjs";
import { addText, emptyIndex, findNetText } from "../lib/nettext.mjs";

const kinds = (t) => scanText(t).map((f) => f.kind);

test("secrets and personal info are caught", () => {
  assert.ok(kinds("AGE-SECRET-KEY-1" + "Q".repeat(58)).includes("age-secret-key"));
  assert.ok(kinds("-----BEGIN OPENSSH " + "PRIVATE KEY-----").includes("private-key"));
  assert.ok(kinds("someone@" + "gmail.com").includes("email"));
  assert.deepEqual(kinds("301894882+PeaceG03@users.noreply.github.com"), []);
});

test("data values are caught", () => {
  assert.ok(kinds("1.25, 2.5, 3.75, 4.1, 5.2, 6.3").includes("numeric-data"));
  assert.ok(kinds('{"close": 187.2}').includes("market-data"));
  assert.deepEqual(kinds("timeout-minutes: 30"), []);
});

test("path allowlist refuses results, data and Net code", () => {
  for (const p of ["results/n0/x.json", "data/bars.csv", "net/model.py", "runner/bin/x.py", "keys/other.pub"]) assert.ok(pathProblem(p), p);
  for (const p of ["README.md", "keys/results.age.pub", ".github/workflows/compute.yml", "runner/bin/seal.sh", "runner/test/leak.test.mjs"]) assert.equal(pathProblem(p), null, p);
});

test("workflows with secrets never take PR triggers", () => {
  assert.ok(workflowProblems("on:\n  pull_request:\njobs:\n  a:\n    environment: net-read\n").length > 0);
  assert.ok(workflowProblems("on: [pull_request]\nenv:\n  K: ${{ secrets.X }}\n").length > 0);
  assert.ok(workflowProblems("on:\n  pull_request_target:\n").length > 0);
  assert.ok(workflowProblems("permissions:\n  contents: write\n").length > 0);
  assert.deepEqual(workflowProblems("on:\n  schedule:\n  workflow_dispatch:\njobs:\n  a:\n    environment: net-read\n"), []);
});

test("Net text is detected by line and shingle hashes", () => {
  const net = emptyIndex();
  const body = ["def walk_forward_replay(days, model, cutoff_volume_from_prior_days_only):", "    for day in days:", "        model.fit(prior(day))", "        preds = model.predict(day)", "        score_against_baselines(preds)"].join("\n");
  addText(net, body);
  const hit = findNetText(body, net);
  assert.ok(hit.lineHits + hit.shingleHits > 0);
  assert.deepEqual(findNetText("echo PASS compute\n", net), { lineHits: 0, shingleHits: 0 });
});
