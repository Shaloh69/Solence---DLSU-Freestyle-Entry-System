#!/usr/bin/env node
// Fails on test patterns that hide failures. See .claude/rules/tests.md.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = ["server/tests", "client/e2e", "client/tests", "solence-vision/tests"];
const tsBad = [
  [/\b(it|test|describe)\.only\s*\(/, ".only"],
  [/\b(it|test|describe)\.skip\s*\(/, ".skip"],
  [/\bx(it|describe)\s*\(/, "xit/xdescribe"],
  [/\btest\.fixme\s*\(/, "test.fixme"],
  [/\.waitForTimeout\s*\(/, "waitForTimeout (wait for a condition)"],
  [/expect\(\s*true\s*\)/, "expect(true)"],
  [/@ts-ignore|@ts-nocheck/, "ts-ignore"],
  [/eslint-disable/, "eslint-disable"],
  [/retries\s*:\s*[1-9]/, "test retries hide flakes"],
];
const pyBad = [
  [/@pytest\.mark\.skip\b|pytest\.skip\(/, "pytest skip"],
  [/@pytest\.mark\.xfail/, "xfail"],
  [/assert\s+True\s*$/m, "assert True"],
];
const hits = [];
function walk(d) {
  let entries;
  try { entries = readdirSync(d); } catch { return; }
  for (const e of entries) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const rules = /\.(ts|tsx|js|mjs)$/.test(e) ? tsBad : /\.py$/.test(e) ? pyBad : null;
    if (!rules) continue;
    const lines = readFileSync(p, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const [re, name] of rules) if (re.test(line)) hits.push(`${relative(root, p).replace(/\\/g, "/")}:${i + 1}  ${name}`);
    });
  }
}
dirs.forEach((d) => walk(join(root, d)));
let allow = [];
try { allow = JSON.parse(readFileSync(join(root, "scripts/hygiene-allowlist.json"), "utf8")).entries ?? []; } catch {}
const debt = [];
for (let i = hits.length - 1; i >= 0; i--) {
  const a = allow.find((e) => hits[i].startsWith(e.file + ":") && hits[i].endsWith(e.rule));
  if (a) { debt.push(`${hits[i]}  (allowed until: ${a.removeBy})`); hits.splice(i, 1); }
}
if (debt.length) console.log(`Test hygiene debt (${debt.length}, allowlisted):\n` + debt.join("\n"));
// Playwright config retries are allowed only on the server-PC perf runner, never globally.
if (hits.length) {
  console.error(`Test hygiene: ${hits.length} problem(s)\n` + hits.join("\n"));
  process.exit(1);
}
console.log("Test hygiene: clean");
