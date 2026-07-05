# Solence — agent instructions

Monorepo: `client/` (Next.js 15 CAD editor), `server/` (Express engine
API), `solence-vision/` (Python AI service, scaffolded). Map:
[README.md](README.md) · run locally: [HOW-TO.md](HOW-TO.md) · API
contract: [server/docs/api.md](server/docs/api.md).

Hard rules:

- **PEC/IES figures are placeholders.** Every code table is flagged
  `PEC-VERIFY`/`LIGHTING-VERIFY`; never present them as verified, never
  inline new compliance numbers outside a flagged data file.
- **No domain math in the frontend.** Everything comes from the Express
  engine through `client/lib/api-client/`.
- Engineering figures render in mono; contract types stay mirrored
  between `server/src/engine/types.ts` and
  `client/lib/api-client/types.ts`.

## Visual development

### Design system
- The binding design system is **`/DESIGN.md`** (tokens, typography,
  banned list, rejection clause). Read it before generating or editing
  ANY UI, and write a component spec (see
  `docs/component-specs/`) before building a new page section.

### Quick visual check
IMMEDIATELY after implementing any front-end change:
1. **Identify what changed** — review the modified components/pages
2. **Navigate to affected pages** — use `mcp__playwright__browser_navigate`
   (or a local dev-server smoke check when Playwright MCP is unavailable)
3. **Verify design compliance** — compare against `/DESIGN.md`,
   especially the §7 banned list
4. **Validate feature implementation** — the change fulfills the request
5. **Capture evidence** — full-page screenshot at 1440px of each changed view
6. **Check for errors** — browser console messages

### Comprehensive design review
Invoke the `design-review` agent (`.claude/agents/design-review.md`) or
run `/design-review` when completing significant UI/UX features or
before finalizing PRs with visual changes. Pair it with the
`avoid-ai-design` skill (`.claude/skills/avoid-ai-design/`) to audit
rendered UI against the banned-pattern catalog; it writes findings to
`AUDIT.md`.
