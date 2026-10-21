#!/usr/bin/env node
// Stop hook, two duties:
// 1. Uncommitted changes → run the fast gate; if it fails, block stopping
//    and hand Claude the failing summary.
// 2. Something was committed this session (HEAD moved since SessionStart
//    recorded it) and no reply since that commit carried the SESSION
//    HANDOFF block → block once and ask for `npm run handoff` (CLAUDE.md §9).
// Both are guarded with stop_hook_active so a stop chain never loops.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MARKER = "SESSION HANDOFF";
const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const art = join(root, ".artifacts");
const sh = (cmd) => spawnSync(cmd, { cwd: root, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const block = (reason) => {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
};

// ---- 1. fast gate on uncommitted work
if (sh("git status --porcelain").stdout?.trim()) {
  const r = sh("node scripts/gate.mjs --fast");
  if (r.status !== 0) {
    const summary = (r.stdout || "").split("\n").slice(0, 40).join("\n");
    if (input.stop_hook_active) {
      process.stderr.write("Fast gate still failing — tell the user plainly which checks fail and do NOT report the item as done.\n" + summary);
      process.exit(0);
    }
    block("Fast gate failed — the current item is not done. Fix the cause (do not weaken checks), re-run `node scripts/gate.mjs --fast`, then finish.\n" + summary);
  }
}

// ---- 2. handoff after a commit
const head = sh("git rev-parse HEAD").stdout.trim();
const startFile = join(art, "session-start-head");
const handedFile = join(art, "handoff-head");
const startHead = existsSync(startFile) ? readFileSync(startFile, "utf8").trim() : head;
const handedHead = existsSync(handedFile) ? readFileSync(handedFile, "utf8").trim() : "";
if (!head || head === startHead || head === handedHead) process.exit(0);

/** Text of the last assistant message: Stop input field if present, else the transcript. */
function lastAssistantText() {
  if (typeof input.last_assistant_message === "string") return input.last_assistant_message;
  try {
    const lines = readFileSync(input.transcript_path, "utf8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const e = JSON.parse(lines[i]);
      const msg = e.message ?? e;
      if ((e.type ?? msg.role) !== "assistant") continue;
      const c = msg.content;
      const text = typeof c === "string" ? c : (c ?? []).filter((p) => p.type === "text").map((p) => p.text).join("\n");
      if (text.trim()) return text;
    }
  } catch {
    return null; // can't read the transcript: fail open, never trap the session
  }
  return "";
}

const text = lastAssistantText();
if (text === null) process.exit(0);
// Continuing in the same session (CLAUDE.md §5) is fine once the bookkeeping
// names the next item: the reply says `CONTINUING WITH <in-progress id>`.
let nowId = "";
try {
  nowId = JSON.parse(readFileSync(join(root, "docs/ROADMAP.json"), "utf8")).items.find((i) => i.status === "in-progress")?.id ?? "";
} catch {}
const continuing = text.match(/^CONTINUING WITH (\S+)/m)?.[1];
if (text.includes(MARKER) || (continuing && continuing === nowId)) {
  mkdirSync(art, { recursive: true });
  writeFileSync(handedFile, head);
  process.exit(0);
}
if (input.stop_hook_active) process.exit(0);
block(
  (continuing
    ? `Your reply says CONTINUING WITH ${continuing}, but ROADMAP.json has ${nowId || "no item"} in-progress. `
    : "You committed work this session but haven't handed off or continued (CLAUDE.md §5, §9). ") +
    "Make sure ROADMAP.json and STATE.md name the next in-progress item, then either put " +
    "`CONTINUING WITH <that id>` on its own line and start it (context still fresh), or run " +
    "`npm run handoff` and paste its full output verbatim at the end of your reply."
);
