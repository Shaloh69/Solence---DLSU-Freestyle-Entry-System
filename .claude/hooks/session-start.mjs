#!/usr/bin/env node
// SessionStart: put the current work state in front of Claude.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const state = join(root, "docs/STATE.md");
const gate = join(root, ".artifacts/gate-summary.md");
let out = "";
const prog = spawnSync("node scripts/progress.mjs", { cwd: root, shell: true, encoding: "utf8" });
if (prog.status === 0) out += prog.stdout + "\n";
if (existsSync(state)) out += readFileSync(state, "utf8");
if (existsSync(gate)) out += "\n\n--- last gate ---\n" + readFileSync(gate, "utf8").split("\n").slice(0, 8).join("\n");
out += "\n\nRules: one item at a time; it is done only when `node scripts/gate.mjs` passes. Template first for any UI. Start your first reply with the SOLENCE PROGRESS block above, verbatim.";
process.stdout.write(out);
