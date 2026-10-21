#!/usr/bin/env node
// Progress toward the revamp goal, computed from docs/ROADMAP.json.
//   node scripts/progress.mjs          print the progress block
//   node scripts/progress.mjs --line   one line (for summaries)
//   node scripts/progress.mjs --check  fail if ROADMAP and STATE.md disagree
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const roadmap = JSON.parse(readFileSync(join(root, "docs/ROADMAP.json"), "utf8"));
const state = readFileSync(join(root, "docs/STATE.md"), "utf8");
const items = roadmap.items;
const pts = (list) => list.reduce((s, i) => s + i.weight, 0);
const done = items.filter((i) => i.status === "done");
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const bar = (p, width = 20) => {
  const full = Math.round((p / 100) * width);
  return "█".repeat(full) + "░".repeat(width - full);
};

if (process.argv.includes("--check")) {
  const errors = [];
  const ids = new Set();
  for (const i of items) {
    if (ids.has(i.id)) errors.push(`duplicate id ${i.id}`);
    ids.add(i.id);
    if (!["todo", "in-progress", "done"].includes(i.status)) errors.push(`${i.id}: bad status ${i.status}`);
    if (![1, 2, 3].includes(i.weight)) errors.push(`${i.id}: weight must be 1, 2 or 3`);
  }
  const active = items.filter((i) => i.status === "in-progress");
  if (active.length !== 1) errors.push(`exactly one item must be in-progress (found ${active.length})`);
  const itemLine = state.split("\n").find((l) => l.startsWith("- Item:")) ?? "";
  if (active[0] && !itemLine.includes(active[0].id)) errors.push(`STATE.md '- Item:' line does not name in-progress item ${active[0].id}`);
  const passed = state.slice(state.indexOf("## Passed"), state.indexOf("## Decisions"));
  for (const i of done) {
    if (!passed.includes(`- ${i.id} (`)) errors.push(`${i.id} is done in ROADMAP but has no '- ${i.id} (' line under STATE.md ## Passed`);
  }
  if (errors.length) {
    console.error("Progress check failed:\n- " + errors.join("\n- "));
    process.exit(1);
  }
  console.log(`Progress check: OK (${pct(pts(done), pts(items))}%)`);
  process.exit(0);
}

const total = pts(items);
const overall = pct(pts(done), total);
const now = items.find((i) => i.status === "in-progress");
const next = items.filter((i) => i.status === "todo").slice(0, 3);
let gate = "not run yet";
const gs = join(root, ".artifacts/gate-summary.md");
if (existsSync(gs)) gate = (readFileSync(gs, "utf8").split("\n").find((l) => l.startsWith("GATE")) ?? gate).trim();

if (process.argv.includes("--line")) {
  console.log(`Progress ${overall}% (${pts(done)}/${total} pts) · now: ${now ? `${now.id} ${now.title}` : "none"}`);
  process.exit(0);
}

const lines = [];
lines.push(`SOLENCE PROGRESS  ${bar(overall)}  ${overall}%  (${pts(done)}/${total} pts, ${done.length}/${items.length} items)`);
for (const ph of roadmap.phases) {
  const list = items.filter((i) => i.phase === ph.id);
  if (!list.length) continue;
  const p = pct(pts(list.filter((i) => i.status === "done")), pts(list));
  lines.push(`  ${ph.id.padEnd(2)} ${ph.name.padEnd(24)} ${bar(p, 10)} ${String(p).padStart(3)}%`);
}
lines.push(`Now:  ${now ? `${now.id} — ${now.title}` : "nothing in progress"}`);
lines.push(`Next: ${next.map((i) => i.id).join(", ") || "—"}`);
lines.push(`Last gate: ${gate}`);
lines.push(`Goal: ${roadmap.goal}`);
console.log(lines.join("\n"));
