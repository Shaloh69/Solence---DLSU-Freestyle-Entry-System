---
paths:
  - "client/**/*.{ts,tsx,css}"
  - "client/tailwind.config.js"
---

# Frontend rules (client/)

- Read `DESIGN.md` §2–§6 before editing any UI file. Tokens only:
  `npm run check:tokens` (created in item 0.6; until then the post-edit
  hook blocks new raw hex) fails on any hex, font, radius, shadow, or
  duration not defined in DESIGN.md.
- UI primitives live in `client/components/ui/` and nowhere else. Screens
  import primitives; they never restyle HeroUI/Radix directly.
- Every primitive has a `/dev/gallery` entry showing all states in both
  themes. No gallery entry → `check:refs` fails.
- New screens and every empty/loading/error state go through the full
  design gate — that is where library defaults sneak back in.
- Motion: only the DESIGN.md §6 tokens and patterns. Every animation has
  a `prefers-reduced-motion` path and is verified by the motion check.
- Never animate the 2D/3D canvas during pointer interaction. Animate
  results (wires drawing in after re-check), not the act of drawing.
- Toasts go through `client/lib/notify.ts` (one API: success, warning,
  danger, info, promise, undo). If it doesn't exist yet, create it as a
  thin sonner wrapper the first time new code needs a toast. Never add a
  direct `sonner` import; the 4 legacy ones are migrated in Phase C.
- The post-edit hook is a ratchet: it compares with the last commit and
  blocks only NEW raw hex, sonner imports, fetch calls or suppression
  comments. Legacy ones may stay while you edit nearby; never add more.
- Destructive actions use the confirm dialog primitive AND an undo
  toast. No one-click deletes.
- Data comes from `client/lib/api-client/`. No `fetch` in components.
- After any UI change run `npm run gate` (its visual/a11y/token/motion
  steps become required as item 0.6 lands); do not report done on a
  screenshot you looked at yourself.
