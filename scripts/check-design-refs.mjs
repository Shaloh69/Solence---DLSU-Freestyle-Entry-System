#!/usr/bin/env node
// Enforces the template rule (CLAUDE.md §2, DESIGN.md §10).
// - every UI primitive in client/components/ui/ has a registry entry
// - every entry has >=1 real reference with an https URL and a capture file
// - status is one of: planned | in-review | approved
// - approved requires: review file, side-by-side report, user sign-off
// - at most ONE entry may be in-review at a time (one item at a time)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const regPath = join(root, "design-refs/registry.json");
const errors = [];
const reg = JSON.parse(readFileSync(regPath, "utf8"));
const items = reg.items ?? [];
const ids = new Set();
const STATUSES = ["planned", "in-review", "approved"];

for (const it of items) {
  const where = `registry item "${it.id ?? "?"}"`;
  if (!it.id || !/^[a-z0-9-]+$/.test(it.id)) errors.push(`${where}: id must be kebab-case`);
  if (ids.has(it.id)) errors.push(`${where}: duplicate id`);
  ids.add(it.id);
  if (!["page", "component", "animation", "3d-scene", "pdf-sheet"].includes(it.kind)) errors.push(`${where}: bad kind`);
  if (!STATUSES.includes(it.status)) errors.push(`${where}: status must be ${STATUSES.join("|")}`);
  const refs = it.references ?? [];
  if (it.status !== "planned") {
    if (!refs.length) errors.push(`${where}: no real reference — no reference, no build`);
    if (!existsSync(join(root, "docs/component-specs", `${it.id}.md`))) errors.push(`${where}: missing docs/component-specs/${it.id}.md`);
  }
  for (const r of refs) {
    if (!/^https:\/\//.test(r.url ?? "")) errors.push(`${where}: reference needs an https url`);
    if (it.status !== "planned" && !(r.capture && existsSync(join(root, "design-refs", r.capture))))
      errors.push(`${where}: reference capture missing (run npm run refs:capture) for ${r.url}`);
  }
  if (it.status === "approved") {
    const rv = it.review ?? {};
    if (!rv.report || !existsSync(join(root, rv.report))) errors.push(`${where}: approved without side-by-side report`);
    if (rv.reviewer !== "design-review-subagent" || rv.verdict !== "pass") errors.push(`${where}: approved without design-review subagent pass`);
    if (!rv.userSignoff) errors.push(`${where}: approved without user sign-off`);
  }
}

const inReview = items.filter((i) => i.status === "in-review");
if (inReview.length > 1) errors.push(`one item at a time: ${inReview.map((i) => i.id).join(", ")} are all in-review`);

const uiDir = join(root, "client/components/ui");
if (existsSync(uiDir)) {
  for (const f of readdirSync(uiDir).filter((f) => /\.tsx$/.test(f))) {
    const id = basename(f, ".tsx").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    if (!ids.has(id)) errors.push(`client/components/ui/${f}: no registry entry "${id}" — every primitive needs a reference`);
  }
}

if (errors.length) {
  console.error(`Design refs: ${errors.length} problem(s)\n- ` + errors.join("\n- "));
  process.exit(1);
}
const counts = STATUSES.map((s) => `${s} ${items.filter((i) => i.status === s).length}`).join(", ");
console.log(`Design refs: OK (${items.length} items — ${counts})`);
