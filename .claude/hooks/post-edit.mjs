#!/usr/bin/env node
// PostToolUse on Edit/Write: immediate feedback to Claude (exit 2 shows
// stderr to Claude; the edit already happened, so Claude must fix it).
//
// RATCHET: client-code checks compare the file with its last committed
// version and flag only what this edit ADDED (a new raw hex value, a new
// direct sonner import, one more fetch or suppression comment). Legacy
// debt (listed in docs/RECONCILE.md "Known debt") stays editable; it is
// removed in Phase C, never grown.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { relative } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const abs = String(input.tool_input?.file_path ?? "");
const p = abs.replace(/\\/g, "/");
let src = "";
try { src = readFileSync(abs, "utf8"); } catch { process.exit(0); }

const rel = relative(root, abs).replace(/\\/g, "/");
const head = spawnSync("git", ["show", `HEAD:${rel}`], { cwd: root, encoding: "utf8" });
const old = head.status === 0 ? head.stdout : "";

const count = (text, re) => (text.match(re) ?? []).length;
const added = (re) => count(src, re) > count(old, re);
const problems = [];

if (/\/(tests?|e2e)\/|\.(test|spec)\.[tj]sx?$/.test(p)) {
  if (/\b(it|test|describe)\.(only|skip)\s*\(|\bx(it|describe)\s*\(|test\.fixme\s*\(/.test(src)) problems.push("focused/skipped test");
  if (/\.waitForTimeout\s*\(/.test(src)) problems.push("waitForTimeout — wait for a condition instead");
}

if (/^client\/|\/client\//.test(p) && /\.(tsx?|css)$/.test(p) && !/tailwind\.config|tokens\.css|circuit-colors\.ts$/.test(p)) {
  const oldHex = new Set((old.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase()));
  const newHex = [...new Set((src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase()))].filter((h) => !oldHex.has(h));
  if (newHex.length) problems.push(`new raw hex ${newHex.slice(0, 5).join(", ")} — use DESIGN.md tokens`);
  if (!/lib\/api-client\//.test(p) && added(/\bfetch\s*\(/g)) problems.push("new fetch() outside lib/api-client");
  if (!/lib\/notify\.ts$/.test(p) && added(/from ["']sonner["']/g)) problems.push("new direct sonner import — toasts go through lib/notify.ts");
}

if (added(/@ts-ignore|@ts-nocheck|eslint-disable/g)) problems.push("new suppression comment");

if (problems.length) {
  process.stderr.write(`${p}: ${problems.join("; ")}. Fix before continuing (CLAUDE.md, .claude/rules/).\n`);
  process.exit(2);
}
process.exit(0);
