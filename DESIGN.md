# Solence DESIGN.md

Read this before generating or editing ANY UI. Exact tokens only — no
improvised colors, fonts, gradients, or component patterns. Section 9
(rejection clause) is binding.

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
| `accent` | `#F59E0B` | Section headers, highlights (warm amber) |

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
| `accent` | `#B45309` | Section headers (amber, darkened for contrast) |

### Semantic (both modes — also the toast palette, section 4.2 of the brief)

| Token | Hex | Use |
| --- | --- | --- |
| `success` | `#22C55E` | Completed actions, passing checks |
| `warning` | `#F59E0B` | Advisory findings, near-limit circuits |
| `danger` | `#E15759` | PEC violations, failures (matches the canvas violation color) |
| `info` | `#4E79A7` | Background-work notices (matches circuit blue #1) |

Circuit color coding lives in `client/lib/circuit-colors.ts` (10-color
categorical palette) — canvas, 3D, schedules, and PDF must all use it;
never invent per-view circuit colors.

## 3. Typography

| Role | Font | Rules |
| --- | --- | --- |
| Display / headlines | **Space Grotesk** | 600–700, `tracking-tight` |
| Body / UI | **IBM Plex Sans** | 400 body, 500 labels, 600 emphasis |
| Numeric / technical | **JetBrains Mono** | Coordinates, VA/amp figures, schedules, status bar, circuit ids |

Type scale (rem): `0.75` caption · `0.8125` dense-table · `0.875` UI base ·
`1` body · `1.25` panel title · `1.5` page title · `2`/`2.5` display.
Engineering figures (amps, VA, lux, meters) are ALWAYS mono — a schedule
with proportional digits reads as a toy.

## 4. Component styling rules

- **Radius scale:** `2px` chips/swatches · `6px` buttons/inputs ·
  `10px` panels/cards/modals. Nothing else. `rounded-full` only for
  status dots and circuit color swatches.
- **Elevation:** panels sit flush — separated by `border` + one
  background step (`surface` → `surface-raised`), NOT by shadows.
  Shadows (`shadow-panel`: `0 4px 18px -6px rgb(0 0 0 / 0.25)`) are
  reserved for things that float: modals, popovers, toasts, drag ghosts.
- **Buttons:** solid `primary` for the one main action per view; flat/
  bordered for everything else. No gradient buttons.
- **Cards/panels:** flat surface + border + dense padding (12px). No
  icon-in-a-rounded-square decoration; lead with data or a mono label.
- **Tables (schedules):** dense rows, mono numerals, top-border header,
  circuit color swatch as a small square (2px radius), not a pill.

## 5. Layout principles

- 8px base grid; spacing steps 4/8/12/16/24/32.
- The CAD canvas dominates: ≥65% of viewport width at xl. Chrome is
  dense (`text-xs`/`text-sm`), panels 12px padding, no hero whitespace
  inside the editor.
- Left = input (tools, library, layers); right = properties (inspector);
  bottom = results (status bar, compliance, schedules). Don't reshuffle.

## 6. Depth & elevation

z-index bands: canvas `0` · docked panels/status bar `10` · sticky
navbar `40` · modals/drawers `50` · toasts `100`. One band per concern;
never stack shadows to fake depth between docked siblings.

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
spec-sheet lists instead of icon card grids; amber sparingly as the
"section header / caution" color the way instrument panels use it.

## 8. Responsive behavior

Follows the four tiers in the brief (section 4.4): xl+ full multi-pane
editor · lg palette+canvas with tabbed inspector · sm–lg tablet
review-leaning stacked panels · <sm no canvas, status/summary/export
only. The banned list applies at every tier — mobile is its own
simplified layout, not a squeezed desktop.

## 9. Rejection clause

Do not introduce colors, fonts, gradients, shadows, radii, or component
patterns not listed in this file. If a needed token or pattern is
missing, STOP and ask — do not invent it, do not fall back to library
defaults. Any diff that adds a hex value not in section 2, a font not in
section 3, or anything from the section 7 banned list is wrong by
definition.
