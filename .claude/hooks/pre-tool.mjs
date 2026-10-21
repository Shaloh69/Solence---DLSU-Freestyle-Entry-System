#!/usr/bin/env node
// PreToolUse guard. Blocks (exit 2) when Claude tries to:
//  - commit without a passing full gate, or bypass git hooks
//  - edit visual baselines, thresholds, or the gate config's required flags
//    without the user's explicit go-ahead (SOLENCE_ALLOW_BASELINE=1)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const tool = input.tool_name;
const ti = input.tool_input ?? {};
const block = (msg) => { process.stderr.write(msg + "\n"); process.exit(2); };

// PowerShell runs the same git/npx commands as Bash on Windows, so it gets the same checks.
if (tool === "Bash" || tool === "PowerShell") {
  const cmd = String(ti.command ?? "");
  if (/--no-verify|-c\s+core\.hooksPath/.test(cmd)) block("Blocked: bypassing git hooks is not allowed (CLAUDE.md §1).");
  // Reading core.hooksPath is fine; setting it to anything but .githooks, or unsetting it, is not.
  const hp = cmd.match(/git\s+config\b([^\n;&|]*?)\bcore\.hooksPath\b[ \t]*([^\s;&|]*)/);
  if (hp) {
    const flags = hp[1], value = hp[2].replace(/^["']|["']$/g, "");
    const reading = /--get(-all|-regexp)?\b|--list\b|(^|\s)-l\b/.test(flags) || (value === "" && !/--unset/.test(flags));
    if (!reading && (/--unset/.test(flags) || value !== ".githooks"))
      block("Blocked: core.hooksPath may only be set to .githooks (CLAUDE.md §1).");
  }
  if (/\bgit\s+push\b.*(--force|-f\b)/.test(cmd)) block("Blocked: force-push needs the user (CLAUDE.md §6).");
  if (/\b(update-snapshots|--update-snapshots|-u\b.*playwright|playwright.*-u\b)/.test(cmd) && process.env.SOLENCE_ALLOW_BASELINE !== "1")
    block("Blocked: regenerating visual baselines needs the user's go-ahead this session (set SOLENCE_ALLOW_BASELINE=1).");
  if (/\bgit\s+commit\b/.test(cmd)) {
    // When the git pre-commit hook is installed it runs the same full gate;
    // don't run it twice. Without it, this hook is the gate.
    const hooksPath = spawnSync("git config core.hooksPath", { cwd: root, shell: true, encoding: "utf8" }).stdout.trim();
    if (hooksPath === ".githooks") process.exit(0);
    const r = spawnSync("node scripts/gate.mjs", { cwd: root, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) {
      const summary = (r.stdout || "").split("\n").slice(0, 40).join("\n");
      block("Blocked: commit refused — full gate failed. Fix the cause, re-run the gate, then commit.\n" + summary);
    }
  }
}

if (["Edit", "Write", "MultiEdit"].includes(tool)) {
  const p = String(ti.file_path ?? "").replace(/\\/g, "/");
  const protectedPath =
    /__screenshots__\/|-snapshots\/|\/baselines?\//.test(p) ||
    /thresholds\.json$/.test(p) ||
    /test-assets\/expectations\//.test(p) ||
    /scripts\/hygiene-allowlist\.json$/.test(p);
  if (protectedPath && process.env.SOLENCE_ALLOW_BASELINE !== "1")
    block(`Blocked: ${p} is a baseline/threshold/expectation file. Changing it needs the user's explicit go-ahead.`);
  if (/scripts\/gate\.config\.json$/.test(p)) {
    const next = String(ti.new_string ?? ti.content ?? "");
    const prev = String(ti.old_string ?? "");
    const loosening = /"required"\s*:\s*true/.test(prev) && /"required"\s*:\s*false/.test(next);
    const wholeRewriteDropsRequired = tool === "Write" &&
      (readFileSync(join(root, "scripts/gate.config.json"), "utf8").match(/"required"\s*:\s*true/g) ?? []).length >
      (next.match(/"required"\s*:\s*true/g) ?? []).length;
    if (loosening || wholeRewriteDropsRequired) block("Blocked: a gate step can be made required, never un-required, without the user.");
  }
}
process.exit(0);
