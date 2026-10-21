#!/usr/bin/env node
// Feeds tool calls to .claude/hooks/pre-tool.mjs and checks each is blocked
// (exit 2) or allowed (exit 0). Item 0.1 found PowerShell bypassing the hook
// and read-only `git config core.hooksPath` being blocked; both stay fixed.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cases = [
  ["Bash", { command: "git commit --no-verify -m x" }, 2],
  ["PowerShell", { command: "git commit --no-verify -m x" }, 2],
  ["Bash", { command: "npx playwright test --update-snapshots" }, 2],
  ["PowerShell", { command: "npx playwright test --update-snapshots" }, 2],
  ["PowerShell", { command: "git -c core.hooksPath=/dev/null commit -m x" }, 2],
  ["Bash", { command: "git config core.hooksPath" }, 0],
  ["Bash", { command: "git config --get core.hooksPath" }, 0],
  ["PowerShell", { command: "git config --get core.hooksPath" }, 0],
  ["Bash", { command: "git config core.hooksPath .githooks" }, 0],
  ["Bash", { command: "git config core.hooksPath /dev/null" }, 2],
  ["Bash", { command: "git config core.hooksPath foo && echo hi" }, 2],
  ["Bash", { command: "git config --unset core.hooksPath" }, 2],
  ["PowerShell", { command: "git config core.hooksPath foo" }, 2],
  ["PowerShell", { command: "git push --force origin revamp" }, 2],
  ["PowerShell", { command: "git status" }, 0],
  ["Edit", { file_path: join(root, "server/tests/thresholds.json"), old_string: "3", new_string: "4" }, 2],
  ["Write", { file_path: join(root, "scripts/hygiene-allowlist.json"), content: "{}" }, 2],
  ["Edit", { file_path: join(root, "client/e2e/home.spec.ts-snapshots/a.png"), old_string: "", new_string: "" }, 2],
  ["Edit", { file_path: join(root, "docs/STATE.md"), old_string: "a", new_string: "b" }, 0],
];

const fails = [];
for (const [tool_name, tool_input, want] of cases) {
  const r = spawnSync("node", [join(root, ".claude/hooks/pre-tool.mjs")], {
    cwd: root, input: JSON.stringify({ tool_name, tool_input }), encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, SOLENCE_ALLOW_BASELINE: "" },
  });
  if (r.status !== want) fails.push(`${tool_name} ${JSON.stringify(tool_input)}: exit ${r.status}, want ${want}`);
}
if (fails.length) {
  console.error(`Hook checks: ${fails.length} problem(s)\n` + fails.join("\n"));
  process.exit(1);
}
console.log(`Hook checks: ${cases.length} cases ok`);
