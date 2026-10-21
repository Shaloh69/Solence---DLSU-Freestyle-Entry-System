#!/usr/bin/env node
// Session handoff: progress + the exact prompt for the next session.
//   node scripts/handoff.mjs           print the handoff (paste it verbatim at the end of a session)
//   node scripts/handoff.mjs --check   fail if any todo/in-progress item has no prompt in docs/PROMPTS.md
//
// The prompt is assembled, never written by hand: the "Session start" block
// from docs/PROMPTS.md + the fenced prompt under the item's own heading
// ("### <id> — …", or the Kickoff heading for M0).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prompts = readFileSync(join(root, "docs/PROMPTS.md"), "utf8");
const roadmap = JSON.parse(readFileSync(join(root, "docs/ROADMAP.json"), "utf8"));
export const MARKER = "SESSION HANDOFF";

/** First fenced block after the heading line matched by `headingRe`, before the next heading. */
function blockAfter(headingRe) {
  const lines = prompts.split("\n");
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start === -1) return null;
  let inFence = false;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!inFence && /^#{2,3} /.test(l)) break;
    if (l.trim().startsWith("```")) {
      if (inFence) return out.join("\n").trim();
      inFence = true;
      continue;
    }
    if (inFence) out.push(l);
  }
  return null;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function itemPrompt(id) {
  if (id === "M0") return blockAfter(/^## Kickoff \(M0\)/);
  return blockAfter(new RegExp(`^### ${esc(id)} — `));
}
const sessionStart = blockAfter(/^## Session start/);

if (process.argv.includes("--check")) {
  const missing = roadmap.items
    .filter((i) => i.status !== "done")
    .filter((i) => !itemPrompt(i.id))
    .map((i) => i.id);
  const errs = [];
  if (!sessionStart) errs.push('docs/PROMPTS.md has no "## Session start" block');
  if (missing.length) errs.push(`no "### <id> — " prompt in docs/PROMPTS.md for: ${missing.join(", ")}`);
  if (errs.length) {
    console.error("Handoff check failed:\n- " + errs.join("\n- "));
    process.exit(1);
  }
  console.log("Handoff check: OK (every remaining item has a prompt)");
  process.exit(0);
}

const progress = spawnSync("node scripts/progress.mjs", { cwd: root, shell: true, encoding: "utf8" }).stdout.trim();
const now = roadmap.items.find((i) => i.status === "in-progress");
const lines = [`===== ${MARKER} =====`, "", progress, ""];

if (!now) {
  lines.push("No item is in progress — every roadmap item is done or blocked. Nothing to paste.");
} else {
  const body = now.id === "M0" ? itemPrompt("M0") : `${sessionStart}\n\n${itemPrompt(now.id)}`;
  lines.push(`Next session: ${now.id} — ${now.title}`);
  lines.push("1. Type /clear");
  lines.push("2. Paste this exact prompt:");
  lines.push("");
  lines.push("```text");
  lines.push(body);
  lines.push("```");
}
lines.push("", `===== END ${MARKER} =====`);
console.log(lines.join("\n"));
