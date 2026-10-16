---
paths:
  - "client/**/*.{ts,tsx,css}"
  - "client/tailwind.config.js"
---

# Frontend rules (client/)

- Read `DESIGN.md` §2–§6 before editing any UI file. Tokens only:
  `npm run check:tokens` fails on any hex, font, radius, shadow, or
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
- Toasts go through `client/lib/notify.ts` only (one API: success,
  warning, danger, info, promise, undo). No direct `toast()` calls.
- Destructive actions use the confirm dialog primitive AND an undo
  toast. No one-click deletes.
- Data comes from `client/lib/api-client/`. No `fetch` in components.
- After any UI change run `npm run gate:ui`; do not report done on a
  screenshot you looked at yourself.
