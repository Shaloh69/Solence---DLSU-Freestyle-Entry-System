---
version: 1.1
name: Solence-design-system
description: Technical instrument-panel precision for a PEC wiring/CAD tool — navy instrument surfaces, teal as the single action color, amber as a scarce caution/eyebrow accent, hairline-border elevation, and a three-face type system where every engineering figure is monospace. Remixed from VoltAgent/awesome-design-md's Together AI entry (technical blueprint voice, mono-caps eyebrows, hairline-over-shadow elevation), calibrated against its NVIDIA (accent as a precious resource, weight-based hierarchy) and ClickHouse (show the real computation, not an illustration of it) entries.

colors:
  # dark mode (primary identity)
  background-dark: "#0B1B33"
  surface-dark: "#13294B"
  surface-dark-raised: "#1B3358"
  border-dark: "#24406B"
  text-dark: "#E6EDF7"
  text-muted-dark: "#93A5C1"
  primary-dark: "#14B8A6"
  accent-dark: "#F59E0B"
  # light mode (drafting paper)
  background-light: "#F4F6FA"
  surface-light: "#FFFFFF"
  surface-light-raised: "#EDF1F7"
  border-light: "#D8DFEA"
  text-light: "#14213A"
  text-muted-light: "#5A6B85"
  primary-light: "#0D9488"
  accent-light: "#B45309"
  # semantic (both modes; also the toast palette)
  success: "#22C55E"
  warning: "#F59E0B"
  danger: "#E15759"
  info: "#4E79A7"

typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: 700
    letterSpacing: -0.8px
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: 600
    letterSpacing: -0.5px
  panel-title:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: 600
    letterSpacing: -0.2px
  body:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: 400
  ui:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
  label:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 500
  dense-table:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
  mono-figure:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
  mono-caps-eyebrow:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: 500
    letterSpacing: 0.08em
    textTransform: uppercase

rounded:
  chip: 2px
  control: 6px
  panel: 10px
  full: 9999px   # status dots and circuit swatch dots ONLY

spacing:
  base: 8px
  steps: [4, 8, 12, 16, 24, 32]
  panel-padding: 12px

components:
  panel:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-padding}"
    shadow: none   # docked panels separate by border + surface step
  status-bar:
    typography: "{typography.mono-figure}"
    backgroundColor: "{colors.surface}"
  schedule-table:
    headerTypography: "{typography.mono-caps-eyebrow}"
    bodyTypography: "{typography.dense-table}"
    swatch: 10px square, {rounded.chip}
  button-primary:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.control}"
    note: one per visible viewport
  toast:
    rounded: "{rounded.panel}"
    shadow: "0 4px 18px -6px rgb(0 0 0 / 0.25)"   # floats, so it may shadow
    semantic: success/warning/danger/info tokens
  panel-eyebrow:
    typography: "{typography.mono-caps-eyebrow}"
    textColor: "{colors.text-muted}"
---

# Solence DESIGN.md

Read this before generating or editing ANY UI. Exact tokens only — no
improvised colors, fonts, gradients, or component patterns. Section 9
(rejection clause) is binding.

Provenance: remixed (not cloned) from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
— base: the **Together AI** entry (technical blueprint voice, uppercase
mono eyebrows, hairline-over-shadow elevation, one-primary-CTA rule);
calibration: **NVIDIA** (accent as a precious resource, hierarchy from
weight/size not color tinting) and **ClickHouse** (show the real
computation — actual schedules, actual figures — never a marketing
illustration of one).

## 1. Visual theme

**Technical instrument-panel precision.** Blueprint/schematic influences:
dense, confident, engineered — closer to a flight deck, oscilloscope, or
CAD toolchrome than a marketing SaaS dashboard. Calibrate against
Linear's information density and restraint and against real CAD
toolbars; never against AI-app landing pages. The canvas is the
instrument; the chrome serves it.

## 2. Color tokens

### Dark mode (primary identity — navy instrument panel)

| Token | Hex | Use |
| --- | --- | --- |
| `background` | `#0B1B33` | App background (brand navy) |
| `surface` | `#13294B` | Panels, cards, tables |
| `surface-raised` | `#1B3358` | Hovered rows, active tabs, popovers |
| `border` | `#24406B` | Panel separation (borders, not shadows) |
| `text-primary` | `#E6EDF7` | Body text |
| `text-muted` | `#93A5C1` | Secondary text, labels, captions |
| `primary` | `#14B8A6` | Actions, selection, focus (brand teal) |
| `accent` | `#F59E0B` | Eyebrows/section markers, caution highlights (warm amber) |

### Light mode (drafting paper)

| Token | Hex | Use |
| --- | --- | --- |
| `background` | `#F4F6FA` | App background (cool paper) |
| `surface` | `#FFFFFF` | Panels, cards |
| `surface-raised` | `#EDF1F7` | Hovered rows, active tabs |
| `border` | `#D8DFEA` | Panel separation |
| `text-primary` | `#14213A` | Body text |
| `text-muted` | `#5A6B85` | Secondary text |
| `primary` | `#0D9488` | Actions, selection, focus (teal, darkened for contrast) |
| `accent` | `#B45309` | Eyebrows/section markers (amber, darkened for contrast) |

### Semantic (both modes — also the toast palette)

| Token | Hex | Use |
| --- | --- | --- |
| `success` | `#22C55E` | Completed actions, passing checks |
| `warning` | `#F59E0B` | Advisory findings, near-limit circuits |
| `danger` | `#E15759` | PEC violations, failures (matches the canvas violation color) |
| `info` | `#4E79A7` | Background-work notices (matches circuit blue #1) |

**Accent scarcity rule (NVIDIA calibration):** amber is a precious
resource — eyebrow labels, spec-sheet indices, and caution highlights
only. If amber appears more than a few times per screen, it stops
meaning anything. Teal is the only action color; one solid-teal primary
CTA per visible viewport.

Circuit color coding lives in `client/lib/circuit-colors.ts` (10-color
categorical palette) — canvas, 3D, schedules, and PDF must all use it;
never invent per-view circuit colors.

## 3. Typography

Three faces, three jobs — the contrast IS the voice (Together AI
calibration):

| Role | Font | Rules |
| --- | --- | --- |
| Display / headlines | **Space Grotesk** | 600–700, `tracking-tight`, ALWAYS sentence case |
| Body / UI | **IBM Plex Sans** | 400 body, 500 labels, 600 emphasis |
| Technical voice | **JetBrains Mono** | Two registers: (a) figures — coordinates, VA/amp/lux values, schedules, status bar, circuit ids; (b) **mono-caps eyebrows** — 11px, weight 500, uppercase, `tracking-widest`, muted or amber — for section/panel labels |

Type scale (rem): `0.6875` eyebrow · `0.75` caption · `0.8125`
dense-table/figures · `0.875` UI base · `1` body · `1.25` panel title ·
`1.5` page title · `2`/`2.5` display. Negative tracking belongs to the
display face only; the mono always tracks positive/wide.

Hard rules: engineering figures are ALWAYS mono (a schedule with
proportional digits reads as a toy). Never set a paragraph in mono.
Never set a headline in all-caps — every uppercase moment belongs to
the mono eyebrow face. Hierarchy comes from weight and size, not from
color tinting.

## 4. Component styling rules

- **Radius scale:** `2px` chips/swatches · `6px` buttons/inputs ·
  `10px` panels/cards/modals. Nothing else. `rounded-full` only for
  status dots and circuit color swatches.
- **Elevation:** panels sit flush — separated by `border` + one
  background step (`surface` → `surface-raised`), NOT by shadows.
  Shadows (`shadow-panel`: `0 4px 18px -6px rgb(0 0 0 / 0.25)`) are
  reserved for things that float: modals, popovers, toasts, drag ghosts.
- **Buttons:** solid `primary` for the one main action per view; flat/
  bordered for everything else. No gradient buttons, no full-pill CTAs.
- **Cards/panels:** flat surface + border + dense padding (12px), led
  by a mono-caps eyebrow or data — never an icon-in-a-rounded-square.
- **Marketing cards (brief §10.4):** asymmetric/bento grids sized by
  content weight — never a uniform 3-up grid. Drafting-convention
  chrome: corner registration marks (short L-shaped strokes at 2–4
  corners), thin schematic borders, a mono technical index label
  (`01`, `SPEC-A`, …) per card. Cards differentiate by content type —
  a spec card carries a data readout, a problem card carries different
  visual weight — never identical layouts with swapped icon+text.
- **Tables (schedules):** dense rows, mono numerals, mono-caps header
  labels, circuit color swatch as a small square (2px radius), not a pill.
- **Content rule (ClickHouse calibration):** show the real computation.
  Marketing and empty-state surfaces display actual engine output —
  real schedules, real conductor sizes, real violation messages — never
  abstract decoration standing in for them.
- **Animated sky (brief §10.3):** the day/night environmental background
  is layered **SVG + CSS keyframes only — never WebGL/canvas** (it is
  chrome and must not compete with the CAD canvas for GPU). Day: sun
  with soft pulsing glow, 2–3 parallax cloud layers at different speeds,
  warm-horizon → cool-top gradient. Night: box-shadow star field with
  randomized (non-synchronized) twinkle, crescent moon as a clean SVG
  with a backlit-dial halo, infrequent randomized shooting stars with
  brief trails. Scope: landing, about, auth, dashboard/project-list
  shells only — **never behind the active editor**. Respect
  `prefers-reduced-motion`; pause when the tab is hidden.
- **Navbar motion (brief §10.8):** restrained and purposeful only —
  scroll-reactive surface (transparent over hero → blurred solid after),
  hide-on-scroll-down / reveal-on-scroll-up, a sliding active/hover link
  indicator, a subtle instrument-glow logo hover (no bounce/spin),
  hamburger-to-X morph with staggered drawer links, and a persistently
  highlighted nav CTA. All gated behind `prefers-reduced-motion`.

## 5. Layout principles

- 8px base grid; spacing steps 4/8/12/16/24/32.
- The CAD canvas dominates: ≥65% of viewport width at xl. Chrome is
  dense (`text-xs`/`text-sm`), panels 12px padding, no hero whitespace
  inside the editor.
- Left = input (tools, library, layers); right = properties (inspector);
  bottom = results (status bar, compliance, schedules). Don't reshuffle.
- Alignment stays consistent within a copy stack — never a centered
  paragraph under a left-aligned headline.

## 6. Depth & elevation

z-index bands: canvas `0` · docked panels/status bar `10` · sticky
navbar `40` · modals/drawers `50` · toasts `100`. One band per concern;
never stack shadows to fake depth between docked siblings. Surface
polarity (navy band ↔ paper band) may carry section separation on
marketing pages; inside the editor, borders do all the work.

## 7. Do's and don'ts

**Banned on sight (the generic-AI catalogue — check every diff against this):**

- The purple-to-blue (or purple-to-indigo) gradient, anywhere.
- Inter as the only font used everywhere.
- The centered-hero-plus-three-icon-cards template.
- Untouched shadcn/HeroUI default zinc/slate with no custom theming.
- Reflexive glassmorphism applied to everything "for polish."
- Icon-in-a-rounded-square as the default card decoration.
- Generic rounded-2xl / shadow-lg on every surface with no variation.
- Copy like "Elevate your workflow" / "Supercharge your…" — UI copy
  included. Solence copy states capability plainly: what it computes,
  to which code section, in how many steps.

**Do:** blueprint/schematic motifs (grid dots, thin rules, mono
annotations, wire-color coding); left-aligned technical layouts; dense
spec-sheet lists with mono indices instead of icon card grids;
mono-caps eyebrows on panels and sections; amber sparingly, the way an
instrument panel uses a caution lamp.

## 8. Responsive behavior

Follows the four tiers in the brief (section 4.4): xl+ full multi-pane
editor · lg palette+canvas with tabbed inspector · sm–lg tablet
review-leaning stacked panels · <sm no canvas, status/summary/export
only. The banned list applies at every tier — mobile is its own
simplified layout, not a squeezed desktop.

## 9. Process (brief §10.9–10.11)

Before generating or revamping any screen: read this file, write a
short component spec per page section (exact tokens, spacing,
interaction states) before building it, then build. After any
meaningful UI change, run the installed `/design-review` workflow
(`.claude/` — OneRedOak design-review + the avoid-ai-design audit)
rather than an ad-hoc self-check; it verifies the rendered page against
this file and the §7 banned list. New screens and empty/loading/error
states go through the same pass — they are where generic defaults
sneak back in.

## 10. Rejection clause

Do not introduce colors, fonts, gradients, shadows, radii, or component
patterns not listed in this file. If a needed token or pattern is
missing, STOP and ask — do not invent it, do not fall back to library
defaults. Any diff that adds a hex value not in section 2, a font not in
section 3, or anything from the section 7 banned list is wrong by
definition.
