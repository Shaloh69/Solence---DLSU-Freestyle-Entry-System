---
version: 2.0
name: Solence design system — "Conductor"
replaces: v1.1 "instrument panel" (navy/teal, Space Grotesk/Plex/JetBrains Mono). v1 is retired in full; see git history.
status: tokens final, references pending capture (Phase C-0)
---

# Solence DESIGN.md v2 — "Conductor"

This file binds every pixel. Tokens only. A value not in this file is
wrong by definition; if one is missing, stop and ask. Nothing ships
without a real reference (§10) and a passed gate (`CLAUDE.md` §1–2).

## 1. Direction

Solence's world is a Philippine electrical plan set: white drafting
sheets, black linework, conductors colored by their insulation, copper
showing where a wire is terminated, and a panel schedule that has to
add up. The design borrows that world's materials instead of a
software-dashboard look.

- **The one memorable thing:** real wiring. Conductor colors (line red,
  neutral white, ground green, black) and copper ends are the visual
  signature — in the hero, in selection, in the 3D. Everything around
  them stays quiet, gray, and exact.
- **Product as proof:** the landing hero is the real engine running on a
  real floor plan from the corpus. No illustrations of the product.
- **Exact, not decorated:** numbers align (tabular figures), units are
  always shown, structure encodes information. No ornament.

What v1 did that v2 drops on purpose: navy + teal, mono-caps eyebrows
above every heading, mono face for figures, `A · B · C` meta strings,
numbered `01/02/03` markers on non-sequences, corner registration marks
as decoration.

## 2. Color

### Light — "sheet" (default for marketing, PDF, print)
| Token | Hex | Use | Contrast on bg |
|---|---|---|---|
| `bg` | `#F4F5F2` | App/page background (cool drafting sheet) | — |
| `surface` | `#FFFFFF` | Panels, cards, dialogs | — |
| `raised` | `#EBEDE9` | Hover rows, active tab, inputs | — |
| `rule` | `#D5D9D4` | Borders, dividers | — |
| `text` | `#1B1F1D` | Body, headings | 15.2 |
| `muted` | `#5C6562` | Secondary text | 5.5 |
| `action` | `#17704A` | Primary action, focus, selection (ground green = correct, safe) | 5.6 |
| `copper` | `#A9561F` | Highlight only: wire terminations, active load, the hero moment | 4.8 |

### Dark — "conduit" (default for the editor and 3D)
| Token | Hex | Contrast on bg |
|---|---|---|
| `bg` `#151918` · `surface` `#1D2220` · `raised` `#262C2A` · `rule` `#343B39` | | — |
| `text` `#E7EAE7` | | 14.6 |
| `muted` `#9CA5A1` | | 7.0 |
| `action` `#45B97F` (text on it: `bg`) | | 7.2 |
| `copper` `#E08A4F` | | 6.7 |

### Signal (status, toasts, compliance)
| Token | Light | Dark | Meaning |
|---|---|---|---|
| `danger` | `#B42A23` | `#F0645C` | PEC violation, failure, destructive |
| `warning` | `#8A6100` | `#E8B341` | Advisory, near-limit |
| `info` | `#2A5BA8` | `#77A3F0` | Background work, neutral notice |
| `success` | = `action` | = `action` | Passed, saved |

All pairs verified ≥ 4.5:1 (WCAG AA) against `bg` and `surface`.

### Conductor palette (the signature)
| Token | Hex | Used for |
|---|---|---|
| `wire-line` | `#C8312A` | Line/hot conductor |
| `wire-line-2` | `#1B1F1D` | Second line (black) |
| `wire-neutral` | `#E9ECE8` + `rule` outline | Neutral |
| `wire-ground` | `#2E8B57` | Equipment ground |
| `copper-end` | `#B87333` | Exposed conductor at terminations |

Circuit colors in the canvas, 3D, schedules and PDF stay in
`client/lib/circuit-colors.ts` (categorical, colorblind-checked). The
conductor palette above is UI/brand; circuit colors identify circuits.
Never mix the two roles.

**Scarcity:** one solid `action` button per view. `copper` appears at
most 3 times per viewport. Signal colors only mean their signal.

## 3. Type

One family, two widths: **Archivo** (variable, `wdth` 62–125, OFL;
`@fontsource-variable/archivo/wdth.css`, self-hosted — never Google CDN).
The wide cut echoes the lettering of a drawing's title block; the normal
cut does everything else.

| Role | Width | Weight | Size / line-height | Tracking |
|---|---|---|---|---|
| display | 125 | 650 | 56/60 (mobile 36/40) | -0.02em |
| h1 | 118 | 620 | 36/42 | -0.015em |
| h2 | 112 | 600 | 26/32 | -0.01em |
| h3 | 100 | 600 | 19/26 | 0 |
| body | 100 | 400 | 16/26 | 0 |
| ui | 100 | 450 | 14/20 | 0 |
| small | 100 | 450 | 12.5/18 | 0.005em |
| figure | 100 | 500, `tabular-nums` | inherits | 0 |

- Every engineering number uses `figure` (tabular figures) and shows its
  unit with a thin space: `3.5 mm²`, `20 A`, `305 lx`. No monospace face.
- Sentence case everywhere. No all-caps labels. No labels above headings
  unless they carry information (e.g. the sheet a section corresponds to).
- Line length ≤ 72ch for body.

## 4. Space, shape, elevation

- 4px base. Steps: 4, 8, 12, 16, 24, 32, 48, 72, 112.
- Radius by hierarchy — never one radius for everything:
  `0` canvas, schedules, sheet previews · `4` inputs, buttons, chips ·
  `8` panels, cards, menus · `12` dialogs, toasts · `999` status dots and
  wire swatches only.
- Elevation: docked panels separate by `rule` + one surface step, no
  shadow. Only floating layers shadow:
  `--shadow-float: 0 1px 0 rgb(0 0 0/.04), 0 12px 32px -12px rgb(16 20 18/.28)`
  (dark: `0 12px 32px -12px rgb(0 0 0/.6)`).
- z-bands: canvas 0 · docked chrome 10 · sticky nav 40 · drawers/dialogs
  50 · command palette 60 · toasts 100.
- Focus: 2px `action` outline, 2px offset, on every interactive element.

## 5. Components (each needs an approved reference, §10)

| Component | Required states / behavior |
|---|---|
| Button: primary, secondary (outlined), ghost, danger, icon | default, hover, active (translateY 1px), focus, loading (spinner replaces icon, width fixed), disabled |
| Input, number input with unit, select, combobox | label above, hint, error text below in `danger`, unit suffix in `muted` |
| Segmented control, tabs | sliding indicator (motion `base`) |
| Table (schedules) | 36px rows, `figure` numerals right-aligned, sticky header, row hover `raised`, circuit swatch 8×8 radius 2 |
| Toast (via `client/lib/notify.ts`) | success, warning, danger, info, promise (simulate/export/AI recognize with live progress from `/ws`), undo action, 5 s default, pause on hover, stack max 3 |
| Dialog, confirm dialog | focus trap, Esc, scrim `rgb(10 12 11/.55)`, destructive confirm names the object ("Delete Demo House?") |
| Drawer / sheet (mobile) | drag to dismiss |
| Command palette (⌘K / Ctrl+K) | tools, rooms, loads, actions; fuzzy search; recent |
| Tooltip, popover, context menu | 400 ms tooltip delay, keyboard reachable |
| Empty state | one sentence saying what to do + the one action |
| Skeleton | for schedules/compliance while simulating; shimmer off under reduced motion |
| Progress / stepper | AI recognize stages, export |
| Status bar | snap, tool, cursor coords, save state, live-check state |
| Compliance item | severity dot, rule title, PEC reference, "Show on plan" |

Never: icon in a rounded square as card decoration; identical card grids
with swapped icons; gradient buttons; glass blur on docked chrome.

## 6. Motion

Tokens: `--dur-instant 80ms` · `--dur-fast 140ms` · `--dur-base 220ms` ·
`--dur-slow 360ms` · `--dur-reveal 900ms` (hero/showcase only).
Easing: `--ease-out cubic-bezier(.16,1,.3,1)` (enter) ·
`--ease-in cubic-bezier(.7,0,.84,0)` (exit) ·
`--ease-inout cubic-bezier(.65,0,.35,1)` (move).

Patterns (the only ones allowed):
1. **Respond to the user** — press, open, expand, toggle: `fast`/`base`.
2. **Show what changed** — after Re-check, routed wires draw in along
   their path (`stroke-dashoffset`, `slow`, staggered 40 ms per circuit,
   capped at 600 ms total); a new violation's row flashes `danger` tint
   once. Schedule figures that change tick to the new value.
3. **One orchestrated moment per page** — landing hero: the real plan
   loads, wires route in, the schedule fills. Showcase: construction
   reveal. Nothing else on the page animates on its own.
- No fade-up-on-scroll for every section. No hover lift on cards.
- Only `transform`, `opacity`, `stroke-dashoffset`, `clip-path`.
- `prefers-reduced-motion: reduce` → final state immediately, same
  layout. Pause when `document.hidden`.
- Budgets (checked on real GPU): p95 frame ≤ 20 ms, no frame > 50 ms.

## 7. Layout

- Editor (dark default): left = tools + library, center = canvas
  (≥ 65% width at ≥1280px), right = inspector, bottom = results
  (compliance, schedules, lighting). Top bar 48px; status bar 28px.
  Chrome text is `ui`/`small`; panels pad 12px.
- Dashboard (projects): page title + one primary action, then projects as
  rows with a live mini-plan thumbnail (rendered from the plan, not an
  icon), last result (circuits, violations), updated time.
- Marketing (light default): 12-col, 1200px max, 24px gutters; left
  aligned copy; sections separated by space (112px) and full-bleed
  surface changes, not by dividers everywhere.
- Mobile < 768px: no canvas editing; project summary, compliance,
  schedules, PDF export. Tabs scroll with an edge fade.

## 8. 3D and rendering

- Real assets only (manifest-backed, licensed). PBR: Poly Haven /
  ambientCG CC0 materials; HDRI lighting from Poly Haven.
- Budgets: scene ≤ 500k triangles, ≤ 150 draw calls, textures ≤ 2048px
  (KTX2/WebP), total GPU texture memory ≤ 256 MB, first meaningful 3D
  frame ≤ 3 s on FormLabs3B.
- Color management: sRGB output, ACES or AgX tone mapping, exposure set
  per HDRI and recorded in the scene config.
- Wires in 3D use the conductor palette with a copper end cap at every
  device; violations glow `danger` (emissive, not bloom on everything).
- Camera: eased transitions (`slow`), no auto-spin except the showcase
  reveal.

## 9. Voice

Plain capability, the user's words: "Check against PEC", "Export permit
PDF", "Sized 3 circuits · 1 warning" → rewrite as "3 circuits sized,
1 warning". An action keeps its name through the flow (button "Export
PDF" → toast "PDF exported"). Errors say what happened and what to do;
they never apologize. Never: "Elevate", "Supercharge", "Seamless",
"Unlock", "AI-powered" as an adjective on everything.

## 10. References — the template rule

Every page, component and animation is built from a real reference
recorded in `design-refs/registry.json` and captured by Playwright.
The list below is the starting set; each must be captured and confirmed
in Phase C-0 (URLs verified live at capture time — drop any that don't
resolve, never substitute an invented one).

| Area | Reference (real, shipping) | What to take from it |
|---|---|---|
| Editor chrome | Onshape web CAD; Figma UI3; Autodesk Forma | panel density, toolbar grouping, inspector rhythm |
| AEC landing | Arcol (browser BIM); Autodesk Forma marketing | product-as-hero for building software |
| Dashboard | Linear; Vercel dashboard | project rows, empty states, density |
| Dialog / popover / menu | Radix Primitives docs demos | focus, scrim, motion |
| Toast | Sonner demo site | stacking, promise, swipe |
| Command palette | cmdk demo; Raycast | grouping, keyboard flow |
| Drawer (mobile) | Vaul demo | drag dismiss |
| Tables | Stripe Dashboard tables | numeric alignment, sticky header |
| 3D presentation | Poly Haven asset viewer; three.js official examples | lighting, tone mapping, camera easing |
| Permit sheet (PDF) | A real PH electrical plan set (title block, load schedule, riser) obtained by the team with permission | sheet layout and conventions |

A reference informs structure and behavior; Solence's tokens replace its
colors and type. Copying a reference's logo, imagery, or copy is never
allowed.
