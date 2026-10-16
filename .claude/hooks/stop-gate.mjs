#!/usr/bin/env node
// Stop: if there are uncommitted changes, run the fast gate. If it fails,
// block stopping and hand Claude the failing summary. Guarded against loops
// with stop_hook_active (only blocks once per stop attempt chain).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const dirty = spawnSync("git status --porcelain", { cwd: root, shell: true, encoding: "utf8" });
if (!dirty.stdout?.trim()) process.exit(0);

const r = spawnSync("node scripts/gate.mjs --fast", { cwd: root, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (r.status === 0) process.exit(0);

const summary = (r.stdout || "").split("\n").slice(0, 40).join("\n");
if (input.stop_hook_active) {
  // Already blocked once; don't loop. Make sure the user sees it.
  process.stderr.write("Fast gate still failing — tell the user plainly which checks fail and do NOT report the item as done.\n" + summary);
  process.exit(0);
}
process.stdout.write(JSON.stringify({
  decision: "block",
  reason: "Fast gate failed — the current item is not done. Fix the cause (do not weaken checks), re-run `node scripts/gate.mjs --fast`, then finish.\n" + summary,
}));
process.exit(0);
