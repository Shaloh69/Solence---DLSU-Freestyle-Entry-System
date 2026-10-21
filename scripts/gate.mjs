#!/usr/bin/env node
// Solence gate runner. `node scripts/gate.mjs [--fast]`
// Runs every step in gate.config.json, writes full logs to .artifacts/gate/,
// a short summary to .artifacts/gate-summary.md, and exits non-zero if any
// required step fails. Optional (not-yet-built) steps are reported, not run.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fast = process.argv.includes("--fast");
const { steps } = JSON.parse(readFileSync(join(root, "scripts/gate.config.json"), "utf8"));
const outDir = join(root, ".artifacts/gate");
mkdirSync(outDir, { recursive: true });

const rows = [];
let failed = 0;
for (const step of steps) {
  if (fast && !step.fast) continue;
  if (!step.required) { rows.push([step.id, "not built (optional)", "-"]); continue; }
  const t0 = Date.now();
  const r = spawnSync(step.run, { cwd: root, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const log = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  writeFileSync(join(outDir, `${step.id}.log`), log);
  const ok = r.status === 0;
  if (!ok) failed++;
  const tail = ok ? "" : log.trim().split("\n").filter(Boolean).slice(-12).join("\n");
  rows.push([step.id, ok ? "PASS" : `FAIL (exit ${r.status})`, `${secs}s`, tail]);
}

const stamp = new Date().toISOString();
const verdict = failed ? `GATE FAILED — ${failed} required step(s) failed` : "GATE PASSED";
let md = `# Gate summary\n\n${verdict} · ${fast ? "fast" : "full"} · ${stamp}\n\n| step | result | time |\n|---|---|---|\n`;
for (const [id, res, t] of rows) md += `| ${id} | ${res} | ${t} |\n`;
for (const [id, , , tail] of rows) if (tail) md += `\n## ${id} — last lines (full log: .artifacts/gate/${id}.log)\n\`\`\`\n${tail}\n\`\`\`\n`;
const prog = spawnSync("node scripts/progress.mjs --line", { cwd: root, shell: true, encoding: "utf8" });
if (prog.status === 0) md = md.replace("\n\n| step", `\n\n${prog.stdout.trim()}\n\n| step`);
writeFileSync(join(root, ".artifacts/gate-summary.md"), md);
console.log(md);
process.exit(failed ? 1 : 0);
