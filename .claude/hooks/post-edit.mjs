#!/usr/bin/env node
// PostToolUse on Edit/Write: immediate feedback to Claude (exit 2 shows
// stderr to Claude; the edit already happened, so Claude must fix it).
import { readFileSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const p = String(input.tool_input?.file_path ?? "").replace(/\\/g, "/");
let src = "";
try { src = readFileSync(p, "utf8"); } catch { process.exit(0); }
const problems = [];
if (/\/(tests?|e2e)\/|\.(test|spec)\.[tj]sx?$/.test(p)) {
  if (/\b(it|test|describe)\.(only|skip)\s*\(|\bx(it|describe)\s*\(|test\.fixme\s*\(/.test(src)) problems.push("focused/skipped test");
  if (/\.waitForTimeout\s*\(/.test(src)) problems.push("waitForTimeout — wait for a condition instead");
}
if (/^client\/|\/client\//.test(p) && /\.(tsx?|css)$/.test(p) && !/tailwind\.config|tokens\.css/.test(p)) {
  const hex = src.match(/#[0-9a-fA-F]{6}\b/g);
  if (hex && !/circuit-colors\.ts$/.test(p)) problems.push(`raw hex ${[...new Set(hex)].slice(0, 5).join(", ")} — use DESIGN.md tokens`);
  if (/\bfetch\s*\(/.test(src) && !/lib\/api-client\//.test(p)) problems.push("fetch() outside lib/api-client");
  if (/from ["']sonner["']/.test(src) && !/lib\/notify\.ts$/.test(p)) problems.push("import toasts via lib/notify.ts, not sonner directly");
}
if (/@ts-ignore|@ts-nocheck|eslint-disable/.test(src)) problems.push("suppression comment");
if (problems.length) {
  process.stderr.write(`${p}: ${problems.join("; ")}. Fix before continuing (CLAUDE.md, .claude/rules/).\n`);
  process.exit(2);
}
process.exit(0);
