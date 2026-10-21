#!/usr/bin/env node
// SessionStart: put the current work state in front of Claude.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const state = join(root, "docs/STATE.md");
const gate = join(root, ".artifacts/gate-summary.md");
let out = "";
// Remember where this session started (the Stop hook uses it, CLAUDE.md §9).
const head = spawnSync("git rev-parse HEAD", { cwd: root, shell: true, encoding: "utf8" }).stdout.trim();
if (head) {
  mkdirSync(join(root, ".artifacts"), { recursive: true });
  writeFileSync(join(root, ".artifacts/session-start-head"), head);
}
const prog = spawnSync("node scripts/progress.mjs", { cwd: root, shell: true, encoding: "utf8" });
if (prog.status === 0) out += prog.stdout + "\n";
if (existsSync(state)) out += readFileSync(state, "utf8");
if (existsSync(gate)) out += "\n\n--- last gate ---\n" + readFileSync(gate, "utf8").split("\n").slice(0, 8).join("\n");
out += "\n\nRules: one item at a time; it is done only when `node scripts/gate.mjs` passes. Template first for any UI. Start your first reply with the SOLENCE PROGRESS block above, verbatim. End the session with the output of `npm run handoff`, verbatim (CLAUDE.md §9).";
process.stdout.write(out);
